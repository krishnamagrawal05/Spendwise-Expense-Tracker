## 🚀 Live Demo
👉 [Open SpendWise Live]
(https://spendwise-expense-tracker-nbyx.onrender.com)

# SpendWise - Expense Tracker

A complete personal-finance web app built with **Python**, **Flask**, **SQLite**, and vanilla **HTML / CSS / JavaScript**.

SpendWise provides a modern fintech-style dashboard for tracking income,
managing expenses, setting monthly budgets, and understanding spending
through charts and financial summaries.

The project is designed to be simple enough for beginners while still
providing a polished and responsive user experience.

---

## Features

### Transaction Management

- Add income transactions
- Add expense transactions
- Edit existing transactions
- Delete transactions
- View all transactions
- Search transactions
- Filter transactions
- Sort transactions
- Add transaction descriptions
- Select transaction categories
- Select transaction dates
- Separate income and expense transactions
- Automatically update financial totals

### Dashboard

- Total balance
- Total income
- Total expenses
- Total savings
- Savings rate
- Monthly financial summary
- Current month selector
- Month-based transaction calculations
- Financial insights
- Recent transaction information
- Quick Add Transaction button
- Monthly budget overview

### Budget Management

- Set a monthly spending limit
- Select the month for the budget
- Update an existing monthly budget
- Remove a monthly budget
- Track total spending against the budget
- Display remaining budget
- Display budget percentage
- Display budget progress
- Detect when the budget is exceeded
- Display budget warning states
- View budget information directly from the dashboard

### Analytics

- Income analytics
- Expense analytics
- Category-based expense analysis
- Monthly financial information
- Interactive charts
- Chart.js integration
- SQLite-based real financial data
- Visual spending breakdown
- Financial comparison information

### Categories

The application supports different categories for organizing
transactions.

Example categories include:

- Food
- Shopping
- Transport
- Bills
- Entertainment
- Health
- Education
- Salary
- Freelance
- Other

Categories make it easier to understand where money is being spent.

### Themes

SpendWise supports both:

- Dark mode
- Light mode

The selected theme is stored in browser `localStorage` so that the
preference can remain available when the user returns to the application.

### Currency

The application includes a currency switcher.

Supported currencies include:

- INR
- USD
- EUR
- GBP

Currency preferences are stored in the browser.

### Settings

The Settings page provides controls for:

- Theme
- Currency
- Notifications
- Sound effects
- Financial insights
- Monthly budget
- Demo data
- Reset demo data
- Clear transactions

### Sound Effects

SpendWise includes optional sound feedback for important interactions.

Sound effects can be enabled or disabled from the Settings page.

The sound system uses the browser's Web Audio API and does not require
external audio files.

### Responsive Design

The interface is designed to work across different screen sizes.

Supported layouts include:

- Desktop
- Laptop
- Tablet
- Mobile phone

The layout automatically adapts cards, forms, navigation, filters,
transactions, and dashboard sections for smaller screens.

### Mobile Experience

The mobile interface includes:

- Responsive dashboard cards
- Mobile transaction layout
- Mobile-friendly forms
- Mobile navigation
- Responsive modal windows
- Touch-friendly buttons
- Responsive filters
- Improved spacing
- Responsive budget section
- Responsive analytics sections

### User Interface

The application includes a modern fintech-inspired interface.

UI improvements include:

- Smooth transitions
- Hover animations
- Interactive cards
- Button animations
- Toast notifications
- Empty states
- Loading states
- Responsive components
- Animated desktop cursor
- Modern dashboard layout
- Consistent spacing
- Rounded cards
- Visual budget progress

---

## Technologies

The project is built using the following technologies:

- Python 3
- Flask
- SQLite
- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js
- Web Audio API
- Font Awesome

No frontend framework is required.

The project uses vanilla JavaScript for the interactive frontend.

---

## Project Structure

```text
expense-tracker/
│
├── app.py
├── database.db
├── requirements.txt
├── README.md
├── .gitignore
│
├── templates/
│   ├── base.html
│   ├── index.html
│   ├── transactions.html
│   ├── analytics.html
│   ├── categories.html
│   ├── settings.html
│   └── 404.html
│
├── static/
│   ├── css/
│   │   └── style.css
│   │
│   ├── js/
│   │   └── script.js
│   │
│   └── images/
│
└── utils/
    ├── __init__.py
    └── database.py