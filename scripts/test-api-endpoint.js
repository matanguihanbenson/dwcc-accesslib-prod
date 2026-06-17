// Test the actual API endpoint
const testAPI = async () => {
  try {
    console.log('Testing API endpoint...');
    
    const response = await fetch('http://localhost:3000/api/borrowing-transactions?status=ACTIVE&limit=10', {
      headers: {
        'Content-Type': 'application/json',
        // You might need to add authentication headers here
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('API Response:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
    
  } catch (error) {
    console.error('Fetch error:', error);
  }
};

testAPI();
