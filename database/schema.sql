-- Hostel Management System Database Schema
CREATE DATABASE IF NOT EXISTS hostel_management;
USE hostel_management;

-- Users table (Admin and Students)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'student') NOT NULL DEFAULT 'student',
    room_no VARCHAR(10),
    batch VARCHAR(20),
    phone VARCHAR(15),
    photo VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_no VARCHAR(10) UNIQUE NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    occupied INT DEFAULT 0,
    type ENUM('single', 'double', 'triple', 'quad') DEFAULT 'double',
    floor INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    status ENUM('present', 'absent', 'late') DEFAULT 'present',
    check_in_time TIME,
    check_out_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance (user_id, date)
);

-- Fees table
CREATE TABLE fees (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    fee_type ENUM('monthly', 'semester', 'annual', 'late_fee') DEFAULT 'monthly',
    status ENUM('pending', 'paid', 'overdue') DEFAULT 'pending',
    due_date DATE NOT NULL,
    paid_date DATE,
    receipt_no VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Complaints table
CREATE TABLE complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    category ENUM('food', 'maintenance', 'electricity', 'cleanliness', 'security', 'other') NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending', 'in_progress', 'resolved', 'rejected') DEFAULT 'pending',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notices table
CREATE TABLE notices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category ENUM('general', 'maintenance', 'event', 'emergency', 'academic') DEFAULT 'general',
    priority ENUM('normal', 'important', 'urgent') DEFAULT 'normal',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Lost and Found table
CREATE TABLE lost_found (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    category ENUM('electronics', 'clothing', 'books', 'accessories', 'other') DEFAULT 'other',
    location_found VARCHAR(100),
    image VARCHAR(255),
    status ENUM('reported', 'claimed', 'unclaimed') DEFAULT 'reported',
    claimed_by INT,
    claimed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Chat messages table
CREATE TABLE chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    message TEXT NOT NULL,
    room ENUM('general', 'announcements', 'support') DEFAULT 'general',
    is_admin_message BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Announcements table
CREATE TABLE announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('general', 'maintenance', 'event', 'emergency') DEFAULT 'general',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Food menu table
CREATE TABLE food_menu (
    id INT PRIMARY KEY AUTO_INCREMENT,
    day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
    meal_type ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
    menu_items TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Laundry service table
CREATE TABLE laundry_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    request_type ENUM('wash', 'iron', 'dry_clean') NOT NULL,
    items_count INT NOT NULL,
    pickup_date DATE NOT NULL,
    delivery_date DATE,
    status ENUM('pending', 'picked_up', 'processing', 'ready', 'delivered') DEFAULT 'pending',
    total_amount DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Visitor registration table
CREATE TABLE visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    visitor_name VARCHAR(100) NOT NULL,
    visitor_phone VARCHAR(15) NOT NULL,
    visitor_id_type ENUM('aadhar', 'pan', 'driving_license', 'passport') NOT NULL,
    visitor_id_number VARCHAR(50) NOT NULL,
    purpose TEXT NOT NULL,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    status ENUM('inside', 'left') DEFAULT 'inside',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Maintenance requests table
CREATE TABLE maintenance_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    room_no VARCHAR(10),
    issue_type ENUM('plumbing', 'electrical', 'furniture', 'cleaning', 'other') NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
    assigned_to VARCHAR(100),
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Events table
CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    location VARCHAR(100),
    event_type ENUM('academic', 'cultural', 'sports', 'social', 'maintenance') DEFAULT 'social',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Feedback table
CREATE TABLE feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    service_type ENUM('food', 'cleaning', 'security', 'maintenance', 'overall') NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user
INSERT INTO users (name, email, password, role) VALUES 
('Admin', 'admin@hostel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Insert sample rooms
INSERT INTO rooms (room_no, capacity, type, floor) VALUES 
('101', 2, 'double', 1),
('102', 2, 'double', 1),
('103', 3, 'triple', 1),
('201', 2, 'double', 2),
('202', 2, 'double', 2),
('203', 4, 'quad', 2);
