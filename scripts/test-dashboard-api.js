// Simple test script for dashboard API
/* eslint-disable @typescript-eslint/no-require-imports */
const fetch = require('node-fetch')

async function testDashboardAPI() {
  try {
    console.log('Testing dashboard stats API...')
    
    const response = await fetch('http://localhost:3000/api/dashboard/stats')
    const data = await response.text()
    
    console.log('Response status:', response.status)
    console.log('Response:', data)
    
    if (response.status === 401) {
      console.log('✅ API is working - returned 401 Unauthorized (expected without auth)')
    } else if (response.status === 200) {
      console.log('✅ API is working - returned data successfully')
    } else {
      console.log('❌ API error - unexpected status:', response.status)
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message)
  }
}

testDashboardAPI()
