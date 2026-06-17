/**
 * Test script to verify password reset functionality
 * This script helps debug password reset issues by testing the flow
 */

async function testPasswordReset() {
  const baseUrl = 'http://localhost:3000'
  
  console.log('🔍 Testing password reset functionality...')
  
  try {
    // First, get a list of users to test with
    console.log('\n1. Fetching users...')
    
    const usersResponse = await fetch(`${baseUrl}/api/admin-accounts`, {
      credentials: 'include'
    })
    
    if (!usersResponse.ok) {
      console.error('❌ Failed to fetch users. Make sure you are logged in as admin.')
      return
    }
    
    const users = await usersResponse.json()
    console.log(`✅ Found ${users.length} users`)
    
    // Find a test user (preferably not SUPER_ADMIN)
    const testUser = users.find(user => user.role === 'STAFF' || user.role === 'USER') || users[0]
    
    if (!testUser) {
      console.error('❌ No suitable test user found')
      return
    }
    
    console.log(`\n2. Testing with user: ${testUser.full_name} (ID: ${testUser.user_account_id})`)
    
    // Test password verification before reset
    console.log('\n3. Testing debug endpoint before reset...')
    const debugBeforeResponse = await fetch(`${baseUrl}/api/debug/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        userId: testUser.user_account_id,
        password: 'oldpassword'
      })
    })
    
    const debugBefore = await debugBeforeResponse.json()
    console.log('Debug before reset:', debugBefore)
    
    // Perform password reset
    const newPassword = `test${Date.now()}`
    console.log(`\n4. Resetting password to: "${newPassword}"`)
    
    const resetResponse = await fetch(`${baseUrl}/api/users/${testUser.user_account_id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        newPassword: newPassword
      })
    })
    
    if (!resetResponse.ok) {
      const error = await resetResponse.json()
      console.error('❌ Password reset failed:', error)
      return
    }
    
    const resetResult = await resetResponse.json()
    console.log('✅ Password reset response:', resetResult)
    
    // Test password verification after reset
    console.log('\n5. Testing debug endpoint after reset...')
    const debugAfterResponse = await fetch(`${baseUrl}/api/debug/verify-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({
        userId: testUser.user_account_id,
        password: newPassword
      })
    })
    
    const debugAfter = await debugAfterResponse.json()
    console.log('Debug after reset:', debugAfter)
    
    // Test login with new password
    console.log('\n6. Testing login with new password...')
    const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        username: testUser.username,
        password: newPassword,
        csrfToken: 'test'
      })
    })
    
    console.log('Login response status:', loginResponse.status)
    
    if (loginResponse.ok) {
      console.log('✅ Login successful with new password')
    } else {
      console.log('❌ Login failed with new password')
      
      // Test with old password (this should fail)
      console.log('\n7. Testing login with old password (should fail)...')
      const oldLoginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          username: testUser.username,
          password: 'oldpassword',
          csrfToken: 'test'
        })
      })
      
      if (oldLoginResponse.ok) {
        console.log('❌ OLD PASSWORD STILL WORKS! This is the bug.')
      } else {
        console.log('✅ Old password correctly rejected')
      }
    }
    
  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPasswordReset()
}

module.exports = { testPasswordReset }
