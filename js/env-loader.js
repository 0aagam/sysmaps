// Environment variable loader for local development
// Loads .env file and makes variables available via window.ENV

export async function loadEnv() {
  try {
    const response = await fetch('.env');
    if (!response.ok) return; // .env file not found or not accessible
    
    const envContent = await response.text();
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) return;
      
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      
      if (key) {
        envVars[key.trim()] = value;
      }
    });
    
    window.ENV = envVars;
    console.log('[ENV] Environment variables loaded');
  } catch (error) {
    console.log('[ENV] No .env file found - using defaults or window.ENV');
  }
}

// Auto-load on import
await loadEnv();
