# Locker Penalty System - Test Cases

## Test 1: Borrow and Return Within 2 Hours (No Penalty)
**Steps:**
1. Borrow locker L-01 at 10:00 AM
2. Verify due_time is set to 12:00 PM (2 hours)
3. Return locker at 11:00 AM
4. **Expected**: No penalty, no overdue settlement created

**SQL Verification:**
```sql
SELECT transaction_id, borrow_time, due_time, return_time, penalty 
FROM locker_transaction 
WHERE locker_id = (SELECT locker_id FROM locker WHERE locker_number = 'L-01')
ORDER BY transaction_id DESC LIMIT 1;

-- Should show penalty = 0.00
```

---

## Test 2: Exceed 2 Hours Without Extension (Penalty Applied)
**Steps:**
1. Borrow locker L-02 at 10:00 AM
2. Verify due_time is 12:00 PM
3. Wait until 12:30 PM (or simulate by changing system time)
4. Check overdue page
5. **Expected**: Locker shows with ₱20 penalty (1 hour exceeded)
6. Return locker at 1:00 PM
7. **Expected**: Final penalty ₱40 (2 hours exceeded), overdue settlement created

**API Check:**
```bash
# Check overdue API
curl http://localhost:3000/api/overdue?type=lockers

# Should show the locker with calculated_penalty = 20 or 40 depending on current time
```

**SQL Verification:**
```sql
-- Check transaction
SELECT transaction_id, borrow_time, due_time, return_time, penalty 
FROM locker_transaction 
WHERE locker_id = (SELECT locker_id FROM locker WHERE locker_number = 'L-02')
ORDER BY transaction_id DESC LIMIT 1;

-- Check settlement
SELECT * FROM overdue_settlement 
WHERE transaction_type = 'LOCKER' 
  AND transaction_id = [transaction_id_from_above]
  AND status = 'PENDING';
```

---

## Test 3: Extend Time Before Deadline (No Penalty)
**Steps:**
1. Borrow locker L-03 at 10:00 AM (due at 12:00 PM)
2. At 11:50 AM, extend time by 2 hours
3. Verify new due_time is 2:00 PM
4. Return at 1:30 PM
5. **Expected**: No penalty, returned before extended deadline

**API Request:**
```bash
# Extend locker time
curl -X PATCH http://localhost:3000/api/locker-transactions/[transaction_id]/extend \
  -H "Content-Type: application/json" \
  -d '{"hours": 2}'
```

**SQL Verification:**
```sql
SELECT transaction_id, borrow_time, due_time, return_time, penalty 
FROM locker_transaction 
WHERE transaction_id = [transaction_id];

-- due_time should be 2:00 PM (14:00)
-- penalty should be 0.00 after return
```

---

## Test 4: Extend Time After Already Overdue (Clears Penalty)
**Steps:**
1. Borrow locker L-04 at 10:00 AM (due at 12:00 PM)
2. Wait until 12:30 PM (30 minutes overdue)
3. Check overdue page - should show ₱20 penalty
4. Extend time by 2 hours
5. Verify penalty is reset to 0
6. Check overdue page - locker should disappear or show ₱0 penalty
7. **Expected**: New due_time is 2:30 PM (12:00 PM original + 2 hours extension), penalty cleared

**SQL Verification:**
```sql
-- Before extension
SELECT transaction_id, due_time, penalty FROM locker_transaction WHERE transaction_id = [id];

-- After extension (should see penalty = 0.00)
SELECT transaction_id, due_time, penalty FROM locker_transaction WHERE transaction_id = [id];

-- Check no pending settlements
SELECT * FROM overdue_settlement 
WHERE transaction_type = 'LOCKER' 
  AND transaction_id = [id] 
  AND status IN ('PENDING', 'PARTIAL');
-- Should return 0 rows
```

---

## Test 5: Multiple Extensions
**Steps:**
1. Borrow locker L-05 at 10:00 AM (due at 12:00 PM)
2. At 11:50 AM, extend by 2 hours → new due: 2:00 PM
3. At 1:50 PM, extend by 2 hours → new due: 4:00 PM
4. Return at 3:30 PM
5. **Expected**: No penalty, all extensions applied correctly

---

## Test 6: Real-time Penalty Calculation on Overdue Page
**Steps:**
1. Borrow locker L-06 at 10:00 AM
2. Let it become overdue (after 12:00 PM)
3. Refresh overdue page at:
   - 12:15 PM → Should show ₱20
   - 1:00 PM → Should show ₱40
   - 2:00 PM → Should show ₱60
4. **Expected**: Penalty increases in real-time based on current time

---

## Automated Test Checklist

### ✅ Functionality Checks
- [ ] Lockers borrowed get automatic 2-hour due_time
- [ ] Lockers appear on overdue page immediately after deadline
- [ ] Penalty calculation: ₱20 per hour, rounded up
- [ ] Extension clears penalty and updates due_time
- [ ] Extension deletes pending overdue settlements
- [ ] Return within time: no penalty, no settlement
- [ ] Return after time: penalty applied, settlement created
- [ ] Real-time penalty updates on overdue page

### 📊 Database Integrity
- [ ] `penalty` field in locker_transaction is decimal(10,2)
- [ ] `due_time` properly stores datetime
- [ ] No orphaned overdue_settlement records after extension
- [ ] Settlement amounts match calculated penalties

### 🎨 UI Checks
- [ ] Overdue page shows correct penalty amounts
- [ ] Duration displays correctly (not negative)
- [ ] Timezone consistent (Asia/Manila) for all timestamps
- [ ] Extend time button works in staff view
- [ ] Return modal shows penalty if applicable

---

## Common Issues and Solutions

### Issue: Duration shows -8:00:00
**Solution**: Already fixed with timezone handling in AdminView.tsx

### Issue: Penalty not cleared after extension
**Solution**: Extension route now deletes pending settlements and resets penalty to 0

### Issue: Locker doesn't appear on overdue page
**Check**: 
- Verify current time is past due_time
- Check if due_time was set correctly on borrow
- Verify overdue API filter logic (lines 246-271 in route.ts)

### Issue: Wrong penalty amount
**Check**:
- Penalty calculation uses Math.ceil() for rounding up
- 20 pesos per hour is hardcoded in return route (line 62, 71)
- Real-time calculation in overdue route (line 307, 314)
