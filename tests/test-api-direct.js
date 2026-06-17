// Test script to check the API directly
const testApi = async () => {
  console.log('Testing departments API...')
  
  try {
    const response = await fetch('http://localhost:3000/api/departments', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', data)
    
    if (data.success && data.data) {
      console.log('Number of departments:', data.data.length)
      if (data.data.length > 0) {
        console.log('First department:', data.data[0])
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

// Test programs API too
const testProgramsApi = async () => {
  console.log('\nTesting programs API...')
  
  try {
    const response = await fetch('http://localhost:3000/api/programs', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', data)
    
    if (data.success && data.data) {
      console.log('Number of programs:', data.data.length)
      if (data.data.length > 0) {
        console.log('First program:', data.data[0])
      }
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run tests
testApi()
testProgramsApi()
