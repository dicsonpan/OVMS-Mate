import net from 'net';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * OVMS V2 Protocol Logger - BMW i3 Adapter
 * 
 * Acts as an "Interactive User App" connecting to OVMS Server.
 * Implements V2 TCP/RC4 Protocol.
 * 
 * Supported Messages:
 * - MP-S (Handshake)
 * - MP-0 S (Status): SoC, Range, Temps, Charge State
 * - MP-0 L (Location): GPS, Speed, Odometer
 */

// Configuration
const CONFIG = {
  vehicleId: process.env.OVMS_ID || 'DEMO_CAR',
  password: process.env.OVMS_PASS || 'DEMO_PASS',
  server: process.env.OVMS_SERVER || 'api.openvehicles.com',
  port: 6867,
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY
};

const supabase = (CONFIG.supabaseUrl && CONFIG.supabaseKey) 
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) 
  : null;

class RC4 {
  constructor(key) {
    this.s = new Array(256);
    this.i = 0;
    this.j = 0;
    for (let i = 0; i < 256; i++) this.s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.s[i] + key[i % key.length]) % 256;
      [this.s[i], this.s[j]] = [this.s[j], this.s[i]];
    }
    // Discard first 1024 bytes as per OVMS spec
    this.process(Buffer.alloc(1024));
  }

  process(buffer) {
    const output = Buffer.alloc(buffer.length);
    for (let k = 0; k < buffer.length; k++) {
      this.i = (this.i + 1) % 256;
      this.j = (this.j + this.s[this.i]) % 256;
      [this.s[this.i], this.s[this.j]] = [this.s[this.j], this.s[this.i]];
      const K = this.s[(this.s[this.i] + this.s[this.j]) % 256];
      output[k] = buffer[k] ^ K;
    }
    return output;
  }
}

class OvmsClient {
  constructor() {
    this.socket = null;
    this.state = 'DISCONNECTED';
    this.rxCipher = null;
    this.txCipher = null;
    this.buffer = '';
    this.lastPing = 0;
    this.pingInterval = null;
  }

  connect() {
    console.log(`[OVMS] Connecting to ${CONFIG.server}:${CONFIG.port} for ${CONFIG.vehicleId}...`);
    this.socket = new net.Socket();
    
    this.socket.connect(CONFIG.port, CONFIG.server, () => {
      console.log('[OVMS] TCP Connected. Waiting for handshake...');
      this.state = 'HANDSHAKE';
    });

    this.socket.on('data', (data) => this.handleData(data));
    this.socket.on('close', () => this.handleClose());
    this.socket.on('error', (err) => console.error('[OVMS] Socket Error:', err.message));
  }

  handleClose() {
    console.log('[OVMS] Connection closed. Reconnecting in 5s...');
    if (this.pingInterval) clearInterval(this.pingInterval);
    setTimeout(() => this.connect(), 5000);
  }

  handleData(raw) {
    let data = raw;
    if (this.state === 'ENCRYPTED' && this.rxCipher) {
      data = this.rxCipher.process(raw);
    }
    const text = data.toString('utf8');
    this.buffer += text;

    let lineEnd;
    while ((lineEnd = this.buffer.indexOf('\r\n')) > -1) {
      const line = this.buffer.substring(0, lineEnd);
      this.buffer = this.buffer.substring(lineEnd + 2);
      this.processMessage(line);
    }
  }

  processMessage(msg) {
    if (msg.startsWith('MP-S')) {
      this.handleHandshake(msg);
    } else if (msg.startsWith('MP-0')) {
      this.handleV2Message(msg);
    }
    // Ping response is usually silent or just an echo, we handle 'A' logic if needed
  }

  handleHandshake(msg) {
    const parts = msg.split(' ');
    const token = parts[2];
    const serverCipher = parts[3];

    // Session Key: HMAC-MD5(password, token)
    const sessionKey = crypto.createHmac('md5', CONFIG.password).update(token).digest();
    // Client Token
    const clientToken = crypto.randomBytes(4).toString('base64');
    // Digest
    const digest = crypto.createHmac('md5', sessionKey).update(clientToken).digest('base64');

    const response = `MP-C ${clientToken} ${digest}`;
    this.socket.write(response + '\r\n');

    const rxKey = crypto.createHmac('md5', sessionKey).update("Server").digest();
    const txKey = crypto.createHmac('md5', sessionKey).update("Client").digest();

    this.rxCipher = new RC4(rxKey);
    this.txCipher = new RC4(txKey);

    this.state = 'ENCRYPTED';
    console.log('[OVMS] Handshake complete. Encrypted.');

    // Start Ping (Heartbeat) every 60s to keep connection alive as an "Interactive App"
    this.pingInterval = setInterval(() => {
      if (this.socket && this.state === 'ENCRYPTED') {
        const ping = this.txCipher.process(Buffer.from('MP-0 A\r\n'));
        this.socket.write(ping);
      }
    }, 60000);
  }

  handleV2Message(msg) {
    // Msg: MP-0 <Type><Data>
    const payload = msg.substring(5); 
    const type = payload.charAt(0);
    const content = payload.substring(1);
    
    // Parse CSV properly handling potential quotes (simplified for OVMS standard)
    const values = content.split(',').map(v => v.trim());

    const telemetry = {};

    switch(type) {
      case 'S': // Status Record
        // Index Mapping for V2 (BMW i3 matches standard V2 layout mostly)
        // 0: SoC (%)
        // 1: Units (K/M)
        // 2: Line Voltage (V)
        // 3: Charge Current (A)
        // 4: Charge State (Done, Stopped, Charging, Top-off)
        // 5: Charge Mode (Standard, Range, Performance)
        // 6: Ideal Range
        // 7: Est Range
        // 8: Charge Time (min)
        // 9: Charge kWh
        // 10: Car Temp (Ambient)
        // 11: Battery Temp
        // 12: Motor Temp
        
        console.log('[OVMS] Status Update:', content);
        
        telemetry.soc = parseFloat(values[0]);
        telemetry.voltage = parseFloat(values[2]);
        telemetry.current = parseFloat(values[3]);
        telemetry.charge_state = values[4]; // text
        telemetry.ideal_range = parseFloat(values[6]);
        telemetry.est_range = parseFloat(values[7]);
        telemetry.range = telemetry.est_range; // Default to est for display
        
        telemetry.temp_ambient = parseFloat(values[10]);
        telemetry.temp_battery = parseFloat(values[11]);
        telemetry.temp_motor = parseFloat(values[12]);

        this.saveTelemetry(telemetry);
        break;

      case 'L': // Location Record
        // 0: Lat, 1: Lng, 2: Direction, 3: Altitude, 4: GPS Lock, 5: Stale
        // 6: Speed, 7: Trip Meter, 8: Drive Mode, 9: Energy Used, 10: Energy Recd
        
        console.log('[OVMS] Location Update:', content);
        
        telemetry.latitude = parseFloat(values[0]);
        telemetry.longitude = parseFloat(values[1]);
        telemetry.speed = parseFloat(values[6]);
        telemetry.odometer = parseFloat(values[7]); // V2 often puts Odometer in Trip or separate
        // Note: For i3, "Trip" in V2 might be the Odometer if configured, 
        // or we need to look at specific metrics. We'll assume field 7 is useful odometer for now.
        
        this.saveTelemetry(telemetry);
        break;
        
      case 'D': 
        // Power/Energy often here.
        // i3 might send power in Watts or kW.
        break;
    }
  }

  async saveTelemetry(data) {
    if (!supabase) return;

    // Map internal keys to DB columns
    // We filter out NaNs
    const cleanFloat = (v) => isNaN(v) ? undefined : v;
    
    const record = {
      vehicle_id: CONFIG.vehicleId,
      timestamp: Date.now(),
      soc: cleanFloat(data.soc),
      range: cleanFloat(data.range),
      est_range: cleanFloat(data.est_range),
      ideal_range: cleanFloat(data.ideal_range),
      speed: cleanFloat(data.speed),
      power: cleanFloat(data.power),
      voltage: cleanFloat(data.voltage),
      current: cleanFloat(data.current),
      charge_state: data.charge_state,
      odometer: cleanFloat(data.odometer),
      temp_battery: cleanFloat(data.temp_battery),
      temp_motor: cleanFloat(data.temp_motor),
      temp_ambient: cleanFloat(data.temp_ambient),
      latitude: cleanFloat(data.latitude),
      longitude: cleanFloat(data.longitude)
    };

    // Remove keys with undefined values to avoid DB null errors if column exists
    Object.keys(record).forEach(key => record[key] === undefined && delete record[key]);

    const { error } = await supabase.from('telemetry').insert(record);
    if (error) console.error('[Supabase] Insert Error:', error.message);
  }
}

const client = new OvmsClient();
client.connect();