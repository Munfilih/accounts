# Accounts Keeper - Advanced Web Application

A comprehensive accounts keeping web application with user authentication, transaction management, and advanced features.

## Features

### Authentication
- Email-based login and signup
- Password strength validation
- JWT token authentication
- User session management

### Core Functionality
- User-wise data segregation
- Transaction management (income/expense)
- Category management with color coding
- Real-time balance calculations
- Responsive Bootstrap UI

### Advanced Features
- Transaction categorization
- Recurring transactions (planned)
- Invoice management (planned)
- Audit trails for accountability
- User role and permission management
- Email notifications (planned)

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Bootstrap 5 for responsive design
- Font Awesome icons

### Backend
- Firebase Authentication
- Firebase Firestore database
- Real-time data synchronization

## Installation

### Prerequisites
- Modern web browser
- Firebase project setup
- npm (for dependencies)

### Setup Steps

1. **Clone/Download the project**
   ```bash
   cd POLUP
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Firebase Setup**
   - Firebase project is already configured
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Set Firestore security rules

4. **Run the application**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

6. **Access the application**
   Open browser and go to `http://localhost:3000`

## Usage

### Getting Started
1. Open the application in your browser
2. Sign up with your email and password
3. Login with your credentials
4. Start managing your accounts!

### Managing Transactions
- Click "Add Transaction" to create new income/expense entries
- Categorize transactions for better organization
- View transaction history and summaries
- Delete transactions as needed

### Categories
- Create custom categories with color coding
- Organize transactions by category
- View category-wise spending patterns

### Dashboard
- View total income, expenses, and net balance
- See recent transactions at a glance
- Monitor your financial health

## Firebase Collections

### Firestore Collections
- `users` - User profiles (auto-managed by Firebase Auth)
- `categories` - Transaction categories per user
- `transactions` - Income and expense records per user
- `recurring_transactions` - Automated recurring entries
- `invoices` - Invoice management
- `audit_log` - Change tracking

## Security Features

- Firebase Authentication
- Firestore security rules
- User data isolation
- Real-time authentication state
- Input validation and sanitization

## Firebase Integration

### Authentication
- Firebase Auth for user registration/login
- Real-time auth state monitoring

### Database Operations
- Firestore for all data storage
- Real-time data synchronization
- User-specific data isolation
- Offline support

## Future Enhancements

- [ ] Recurring transaction automation
- [ ] Advanced invoice features
- [ ] Email notifications
- [ ] Data export (CSV, PDF)
- [ ] Mobile app
- [ ] Multi-currency support
- [ ] Budget planning
- [ ] Financial reports and charts
- [ ] Cloud storage integration
- [ ] Collaborative features

## Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please create an issue in the repository.