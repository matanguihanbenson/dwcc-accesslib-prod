// Test script to check API endpoints
const fetch = require('node-fetch');

async function testAPIs() {
  try {
    console.log('Testing /api/departments...');
    
    const deptResponse = await fetch('http://localhost:3000/api/departments', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Departments response status:', deptResponse.status);
    
    if (deptResponse.ok) {
      const deptData = await deptResponse.json();
      console.log('Departments response:', JSON.stringify(deptData, null, 2));
    } else {
      const errorText = await deptResponse.text();
      console.log('Departments error response:', errorText);
    }
    
    console.log('\nTesting /api/programs...');
    
    const progResponse = await fetch('http://localhost:3000/api/programs', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Programs response status:', progResponse.status);
    
    if (progResponse.ok) {
      const progData = await progResponse.json();
      console.log('Programs response:', JSON.stringify(progData, null, 2));
    } else {
      const errorText = await progResponse.text();
      console.log('Programs error response:', errorText);
    }
    
  } catch (error) {
    console.error('Error testing APIs:', error);
  }
}

testAPIs();
