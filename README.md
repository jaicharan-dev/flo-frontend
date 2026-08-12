# Flo - Personal Finance UI

![HTML5](https://img.shields.io/badge/HTML5-E34F26)
![CSS3](https://img.shields.io/badge/CSS3-1572B6)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-F7DF1E)

**Flo UI** is the lightweight, lightning-fast frontend client for the Flo Personal Finance Application. It is built entirely with Vanilla JavaScript, HTML, and CSS to demonstrate strong foundational web development skills without the overhead of heavy JavaScript frameworks.

## 🌟 Highlights

- **Modular Design:** Clean separation of concerns with dedicated files for structure (`index.html`), styling (`styles.css`), and logic (`app.js`).
- **Lightning Fast:** Zero dependencies, minimal footprint, and native DOM manipulation ensure maximum performance.
- **Secure Authentication:** Implements secure JWT token handling with automatic token refresh mechanisms via the backend API.
- **Dynamic Dashboards:** Real-time generation of KPI metrics, interactive progress bars for budget utilization, and responsive transaction tables.
- **AI Integration:** Seamlessly interfaces with the Google Gemini-powered backend to stream conversational financial insights directly into the dashboard.

## 📁 Repository Structure
```
/
├── index.html   # Main application structure and layout
├── styles.css   # Custom styling (CSS Variables, Flexbox, Grids)
└── app.js       # Core application logic, API calls, and state management
```

## 🚀 Getting Started

Since this is a pure Vanilla JS single-page application, no build steps (like `npm run build`) are required!

1. **Clone the repository:**
   ```bash
   git clone https://github.com/jaicharan-dev/flo-frontend.git
   cd flo-frontend
   ```

2. **Run it locally:**
   Simply open `index.html` in any modern web browser.
   For the best experience, run a simple local web server:
   ```bash
   npx serve . 
   # or using Python
   python -m http.server 3000
   ```

3. **Backend Connection:**
   The frontend automatically connects to the backend API.
   - If running on `localhost`, it targets `http://localhost:8000`.
   - If deployed to the internet (e.g. Vercel), it safely routes traffic to the live Render backend `https://flo-api.onrender.com`.

## 🌐 Deployment
This frontend is optimized for static hosting and is currently deployed on **Vercel** for instant, globally distributed edge delivery.
