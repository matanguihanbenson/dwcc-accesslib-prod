-- Migration to add overdue settlement tracking
CREATE TABLE overdue_settlement (
  settlement_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  transaction_type ENUM('BOOK', 'LOCKER') NOT NULL,
  transaction_id INT NOT NULL,
  penalty_amount DECIMAL(10, 2) NOT NULL,
  amount_paid DECIMAL(10, 2) DEFAULT 0.00,
  remaining_balance DECIMAL(10, 2) NOT NULL,
  status ENUM('PENDING', 'PARTIAL', 'SETTLED') DEFAULT 'PENDING',
  settled_at DATETIME NULL,
  processed_by INT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_transaction_type (transaction_type),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  
  FOREIGN KEY (user_id) REFERENCES user(user_id) ON DELETE CASCADE
);
