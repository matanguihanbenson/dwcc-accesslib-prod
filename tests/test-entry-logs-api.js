const http = require('http');

// Test the entry logs API endpoint
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/entry-logs?include_user=true&limit=50',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('Response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data && response.data.logs) {
        console.log(`\nFound ${response.data.logs.length} entry logs`);
        response.data.logs.forEach((log, index) => {
          console.log(`${index + 1}. ${log.user?.full_name || 'Unknown'} - Entry: ${log.entry_time}, Exit: ${log.exit_time || 'Still inside'}`);
        });
      }
    } catch (error) {
      console.error('Failed to parse response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.end();
