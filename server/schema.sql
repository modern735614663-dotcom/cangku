-- 紫城服饰仓库管理系统 数据库建表语句
-- 在小皮面板中创建数据库 warehouse，然后导入此文件

CREATE DATABASE IF NOT EXISTS warehouse DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE warehouse;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 货品表
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  color VARCHAR(50) NOT NULL,
  size VARCHAR(20) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 库存表
CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warehouse_id VARCHAR(20) NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_warehouse_product (warehouse_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 入库单主表
CREATE TABLE IF NOT EXISTS inbound_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(100) NOT NULL,
  warehouse_id VARCHAR(20) NOT NULL,
  operator VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 入库单明细
CREATE TABLE IF NOT EXISTS inbound_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doc_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (doc_id) REFERENCES inbound_docs(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 出库单主表
CREATE TABLE IF NOT EXISTS outbound_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reason VARCHAR(100) NOT NULL,
  warehouse_id VARCHAR(20) NOT NULL,
  operator VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 出库单明细
CREATE TABLE IF NOT EXISTS outbound_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doc_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  FOREIGN KEY (doc_id) REFERENCES outbound_docs(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 转仓单
CREATE TABLE IF NOT EXISTS transfer_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_warehouse VARCHAR(20) NOT NULL,
  to_warehouse VARCHAR(20) NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  operator VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB;

-- 操作日志
CREATE TABLE IF NOT EXISTS operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operator VARCHAR(50) NOT NULL,
  type ENUM('inbound', 'outbound', 'transfer') NOT NULL,
  doc_id INT NOT NULL,
  summary TEXT,
  detail JSON,
  items JSON,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  revoke_info JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 待审核单据
CREATE TABLE IF NOT EXISTS pending_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('inbound', 'outbound') NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  username VARCHAR(50) NOT NULL,
  source VARCHAR(100),
  reason VARCHAR(100),
  warehouse_id VARCHAR(20) NOT NULL,
  items JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  reviewed_by VARCHAR(50)
) ENGINE=InnoDB;

-- 插入默认管理员 (密码: admin123)
INSERT INTO users (username, password_hash, role) VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin')
ON DUPLICATE KEY UPDATE username=username;
