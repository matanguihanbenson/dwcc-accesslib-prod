// Test script for borrowing transactions API
const testBorrowingTransactionsAPI = async () => {
  console.log('Testing Borrowing Transactions API...\n');

  const baseURL = 'http://localhost:3000';
  
  // Test general transactions endpoint
  try {
    console.log('1. Testing general borrowing transactions:');
    const response1 = await fetch(`${baseURL}/api/borrowing-transactions`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('✅ General transactions API working');
      console.log(`   Found ${data1.data?.total || 0} total transactions`);
    } else {
      console.log('❌ General transactions API failed:', response1.status, response1.statusText);
    }
  } catch (error) {
    console.log('❌ General transactions API error:', error.message);
  }

  // Test user-specific transactions endpoint  
  try {
    console.log('\n2. Testing user-specific borrowing transactions (user=4):');
    const response2 = await fetch(`${baseURL}/api/borrowing-transactions?user_id=4`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ User-specific transactions API working');
      console.log(`   Found ${data2.data?.total || 0} transactions for user 4`);
      if (data2.data?.transactions?.length > 0) {
        console.log('   Sample transaction:', {
          id: data2.data.transactions[0].transaction_id,
          book: data2.data.transactions[0].book?.title,
          status: data2.data.transactions[0].status
        });
      }
    } else {
      console.log('❌ User-specific transactions API failed:', response2.status, response2.statusText);
    }
  } catch (error) {
    console.log('❌ User-specific transactions API error:', error.message);
  }

  // Test library user details API
  try {
    console.log('\n3. Testing library user details API (user ID 4):');
    const response3 = await fetch(`${baseURL}/api/library-users/4`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response3.ok) {
      const data3 = await response3.json();
      console.log('✅ Library user details API working');
      console.log(`   User: ${data3.data?.full_name} (${data3.data?.account_id})`);
      console.log(`   Book transactions: ${data3.data?.book_transactions?.length || 0}`);
      console.log(`   Entry logs: ${data3.data?.entry_logs?.length || 0}`);
    } else {
      console.log('❌ Library user details API failed:', response3.status, response3.statusText);
    }
  } catch (error) {
    console.log('❌ Library user details API error:', error.message);
  }
};

testBorrowingTransactionsAPI().catch(console.error);
