# 🛒 Dukaan Dost
                      
### 📊 Your Smart Stock & Restocking Assistant for Kiryana Shops 🇵🇰
              
Dukaan Dost helps small shop owners manage their stock, predict future product demand, and decide when and how much to restock.

🏆 Built for the **AMD Developer Hackathon ACT III**, Track 3: *Reinvent Commerce*.

## 💡 What Does Dukaan Dost Do?

Running a small grocery shop can be challenging. Shopkeepers need to know which products will sell, which items might run out, and how much stock they should order.

Dukaan Dost makes this process easier! 🌟

Shop owners can upload their daily sales data in CSV format containing:

- 📅 `date`  
- 🛍️ `product`  
- 📦 `units_sold`

The application analyzes past sales and helps shopkeepers plan for the next seven days.

### ✨ Key Features

- 📈 **7-Day Sales Forecast:** Predicts upcoming demand for each product using weekday sales patterns and exponential smoothing.
- 🚨 **Low-Stock Alerts:** Identifies products that may run out before the next delivery.
- 📦 **Smart Restocking Suggestions:** Recommends how much stock to order based on forecast demand and available stock information.
- 🤖 **AI-Powered Explanations:** Uses an open model through AMD Token Factory to explain forecasts in simple English or Roman Urdu.
- 💬 **WhatsApp Supplier Messages:** Drafts messages that shopkeepers can use to contact their suppliers.
- 🔒 **Number Safety Check:** Blocks AI-generated drafts containing numbers that are not supported by the provided data.
- 🧪 **Sales Backtesting:** Tests forecasting performance against historical sample data.

The forecasting and restocking calculations run through regular code, while AI helps explain the results and prepare supplier messages. This keeps the main calculations separate from AI-generated text. 🧠

## ⚙️ How It Works

1. 📂 **Upload sales data:** Add a CSV file containing daily product sales.
2. 📊 **Analyze past sales:** The forecasting engine identifies sales patterns and estimates future demand.
3. 🔮 **Forecast the next seven days:** The application predicts how many units of each product may sell.
4. 🚨 **Check stock risks:** It identifies products that could run out before the next delivery.
5. 📦 **Plan restocking:** Review suggested order quantities.
6. 💬 **Get an explanation:** Read the results in English or Roman Urdu and generate a supplier WhatsApp message.

## 🛠️ Technology & Architecture

- 🌐 **Frontend:** HTML, CSS, and JavaScript.
- 📊 **Forecasting Engine:** Weekday sales patterns and exponential smoothing.
- 🧪 **Backtesting:** Historical sales data used to evaluate forecast performance.
- 🤖 **AI Integration:** AMD Token Factory with a configurable model.
- 🔐 **Output Validation:** Checks AI-generated text for unsupported numbers.
- 🚀 **Deployment:** Vercel static hosting and a serverless API function.
- 🧑‍💻 **Testing:** Automated engine tests using `npm test`.

## 🚀 Run the Project Locally

Dukaan Dost uses a static website and one serverless function, so no frontend build step is required.

### 1. Install dependencies
        
Make sure Node.js and npm are installed, then run:

```bash
npm install
```

### 2. Run the tests

```bash
npm test
```

### 3. Configure AI access

Create a local `.env` file using `.env.example` as a reference and configure:

```text
AMD_BASE_URL=your_amd_base_url
AMD_API_KEY=your_amd_api_key
AMD_MODEL=your_model_name
```

🔒 Never upload your real API key to a public GitHub repository.

### 4. Start the local application

```bash
npx vercel dev
```

Configure the required environment variables in your local Vercel environment so the AI explanation function can access AMD Token Factory.

💡 **No AI credentials?** The application can still work using its built-in explanation template.

## ☁️ Deploy on Vercel

1. 📤 Push the project to a GitHub repository without any secrets.
2. 🚀 Import the repository into Vercel.
3. ⚙️ Select **Other** as the framework preset.
4. 📁 Set the output directory to `public`.
5. 🔑 Add `AMD_BASE_URL`, `AMD_API_KEY`, and `AMD_MODEL` as environment variables.
6. 🌐 Deploy and test the application.

## 📁 Project Structure

```text
dukaan-dost/
│
├── public/
│   ├── index.html    # 🖥️ User interface
│   └── engine.js     # 📊 Forecasting, backtesting,
│                     #    restocking rules and sample data
│
├── api/
│   └── explain.js    # 🤖 AMD Token Factory integration
│                     #    and AI number validation
│
├── .env.example      # 🔑 Environment variable template
├── package.json      # 📦 Project scripts and dependencies
└── README.md         # 📖 Project documentation
```

## ⚠️ Honest Limitations

Transparency is important, especially when helping small businesses make stock decisions. 💚

- 🧪 **Sample data:** The demonstration shop uses synthetic data. Its 28-day test demonstrates the method, not guaranteed savings or real-world accuracy.
- 📦 **Stock availability:** Reducing stockouts may require keeping more inventory, which can increase holding costs.
- 🎉 **Seasonal demand:** The current system does not account for festivals, special events, or sudden changes in buying habits.
- 💰 **Price changes:** It does not currently model changing product prices.
- 🚚 **Supplier issues:** Supplier shortages and unexpected delivery delays are not fully modeled.
- 🔮 **Forecast uncertainty:** Predictions are estimates, not guarantees of future sales.

## 🌟 Our Vision

Our goal is to make practical technology accessible to small shop owners who may not have advanced inventory systems or data analysis skills.

By combining sales forecasting, simple restocking suggestions, and explanations in familiar languages, **Dukaan Dost aims to make everyday stock management easier for local kiryana shops.** 🛒🇵🇰

**Less guesswork. Smarter restocking. Better-informed shopkeepers.** 📊🤝

