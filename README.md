# DWCC AccessLib - Library Management System

A comprehensive library management system for Divine Word College of Calapan, built with Next.js 15, TypeScript, and modern web technologies.

## Features

### User Management
- **Multi-role authentication** (Super Admin, Admin, Staff, User)
- **User types** (Students, Employees, Alumni, Guests)
- **RFID integration** for quick access
- **Account management** with proper access controls

### Library Operations
- **Book management** with categorization
- **Borrowing system** with due date tracking
- **Locker assignment** and monitoring
- **Entry/exit logging** via RFID
- **Overdue tracking** with penalty calculation

### Administrative Features
- **Real-time dashboard** with statistics
- **Comprehensive reporting** (Excel/PDF export)
- **Audit logging** for all system activities
- **User activity monitoring**
- **Email notifications** for overdue items

## Tech Stack

### Frontend
- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React 19** with modern hooks
- **Browser Alerts** for notifications

### Backend
- **Next.js API Routes** for serverless functions
- **NextAuth.js** for authentication
- **Prisma ORM** for database management
- **MySQL/MariaDB** as database

### Development
- **ESLint** for code quality
- **TypeScript** strict mode
- **Hot reload** development server

## Project Structure

```
dwcc-accesslib/
├── app/                          # Next.js App Router pages
│   ├── api/                      # API routes
│   ├── dashboard/                # Dashboard page
│   ├── login/                    # Login page
│   └── ...
├── components/                   # Reusable UI components
│   ├── ui/                       # Basic UI components
│   └── layout/                   # Layout components
├── lib/                          # Core utilities and services
│   ├── services/                 # Business logic services
│   ├── hooks/                    # Custom React hooks
│   └── ...
├── prisma/                       # Database schema and migrations
├── types/                        # TypeScript type definitions
└── public/                       # Static assets
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- MySQL/MariaDB database
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dwcc-accesslib
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```

   Configure the following variables:
   ```env
   DATABASE_URL="mysql://username:password@localhost:3306/dwcc_accesslib"
   JWT_SECRET="your-jwt-secret-key"
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:3000"
   ```

4. **Set up the database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## Database Schema

The system uses a comprehensive database schema with the following key entities:

- **Users** - Library users (students, employees, etc.)
- **UserAccounts** - Login credentials and roles
- **Books** - Book inventory with categories
- **BookTransactions** - Borrowing records
- **Lockers** - Locker inventory
- **LockerTransactions** - Locker usage records
- **EntryLogs** - Entry/exit tracking
- **AuditLogs** - System activity logs
- **NotificationLogs** - Email notifications
- **ReportLogs** - Generated reports
- **PenaltyConfig** - Penalty rules
- **SystemConfig** - System settings

## Key Features Implementation

### Authentication & Authorization
- Role-based access control (RBAC)
- Session management with NextAuth.js
- Account lockout after failed attempts
- Audit logging for security events

### Business Logic
- Service layer pattern for clean architecture
- Transaction-based operations
- Proper error handling and validation
- Automated penalty calculation

### User Interface
- Responsive design with Tailwind CSS
- Reusable component library
- Real-time updates
- Intuitive navigation

### Data Management
- Type-safe database operations with Prisma
- Comprehensive validation
- Data export capabilities
- Audit trail maintenance

## API Documentation

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signout` - User logout

### Users
- `GET /api/users` - List user accounts
- `POST /api/users` - Create user account
- `GET /api/library-users` - List library users
- `POST /api/library-users` - Create library user

### Books
- `GET /api/books` - List books
- `POST /api/books` - Create book
- `POST /api/books/[id]/borrow` - Borrow book
- `POST /api/borrowing-transactions/[id]/return` - Return book

### Entry Logs
- `GET /api/entry-logs` - List entry logs
- `POST /api/entry-logs` - Record entry/exit

## Development Guidelines

### Code Style
- Use TypeScript for all new code
- Follow React functional component patterns
- Implement proper error boundaries
- Use custom hooks for reusable logic

### Database Operations
- Use Prisma for all database operations
- Implement proper transactions for complex operations
- Include proper indexing for performance
- Use soft deletes where appropriate

### Security
- Validate all inputs
- Use proper authentication checks
- Implement rate limiting where needed
- Log security-relevant events

## Deployment

### Production Build
```bash
npm run build
npm start
```

### Environment Configuration
- Set `NODE_ENV=production`
- Configure production database
- Set secure JWT secrets
- Enable SSL/TLS

### Database Migrations
```bash
npx prisma migrate deploy
```

## Contributing

1. Follow the established code structure
2. Add proper TypeScript types
3. Include error handling
4. Write meaningful commit messages
5. Test thoroughly before submitting

## License

This project is developed for Divine Word College of Calapan.

## Support

For technical support or questions, contact the development team.