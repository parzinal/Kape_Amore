import { useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import {
  AdminPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from "./auth/AuthPages";
import { RequireAuth } from "./auth/RouteGuards";
import { AccountDashboard } from "./dashboard/AccountDashboard";

const drinks = [
  {
    name: "Latte",
    note: "Double espresso · steamed milk",
    price: "₱145",
    tag: "COFFEE BAR",
    image:
      "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=1000&q=90",
    imageAlt: "Latte art on a freshly made latte",
  },
  {
    name: "Butter Croissant",
    note: "Flaky pastry · baked golden",
    price: "₱95",
    tag: "FROM THE OVEN",
    image:
      "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=1000&q=90",
    imageAlt: "Freshly baked golden croissants",
  },
  {
    name: "Iced Spanish Latte",
    note: "Espresso · cold milk · house sweetness",
    price: "₱155",
    tag: "CUSTOMER FAVORITE",
    image:
      "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1000&q=90",
    imageAlt: "Iced coffee in a clear glass",
  },
];

function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#home" aria-label="Kape Amore home" onClick={closeMenu}>
          <img className="brand-logo" src="/images/kape-amore-logo.png" alt="" />
          <span className="wordmark-name"><span>KAPE <em>AMORE</em></span><small>COFFEE · FOOD · GOOD VIBES</small></span>
        </a>

        <button
          className={`menu-toggle${menuOpen ? " is-open" : ""}`}
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
        </button>

        <nav className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
          <a href="#home" onClick={closeMenu}>Home</a>
          <a href="#menu" onClick={closeMenu}>The menu</a>
          <a href="#story" onClick={closeMenu}>Our story</a>
          <a href="#visit" onClick={closeMenu}>Visit</a>
          <Link className="nav-account-link" to="/login" onClick={closeMenu}>Sign in</Link>
          <a className="nav-cta" href="#menu" onClick={closeMenu}>Order now <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="hero-image" role="img" aria-label="A freshly made coffee on a café table" />
        <div className="hero-copy">
          <p className="eyebrow"><span /> COFFEE FOR EVERYDAY MOMENTS</p>
          <h1>Your daily<br />cup of <em>comfort.</em></h1>
          <p className="hero-description">
            Specialty coffee, made fresh for your everyday moments. Come as
            you are; we’ll put the kettle on.
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#menu">Order now <span aria-hidden="true">↗</span></a>
            <a className="text-link" href="#menu">View menu <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="hero-photo-caption">
          <span>POUR OVER</span>
          <span>BREWED TO ORDER</span>
        </div>
      </section>

      <section className="menu-section section-pad" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> A GOOD PLACE TO START</p>
            <h2>Favorites from<br />the <em>coffee bar.</em></h2>
          </div>
          <p className="section-intro">
            The familiar ones, made properly. Find your usual—or make a new one.
          </p>
        </div>
        <div className="menu-grid">
          {drinks.map((drink, index) => (
            <article className="menu-card" key={drink.name}>
              <div className="menu-card-image">
                <img src={drink.image} alt={drink.imageAlt} loading="lazy" />
                <span className="menu-number">0{index + 1}</span>
              </div>
              <div className="menu-card-details">
                <div className="menu-card-copy">
                  <span className="menu-tag">{drink.tag}</span>
                  <h3>{drink.name}</h3>
                  <p className="menu-note">{drink.note}</p>
                </div>
                <span className="menu-price">{drink.price}</span>
              </div>
            </article>
          ))}
        </div>
        <a className="menu-more" href="#visit">Visit Kape Amore <span aria-hidden="true">↗</span></a>
      </section>

      <div className="service-strip" aria-label="Ways to enjoy Kape Amore">
        <span>01 <strong>DINE IN</strong></span>
        <span>02 <strong>TAKE AWAY</strong></span>
        <span>03 <strong>DELIVERY</strong></span>
        <span className="service-strip-note">YOUR COFFEE, YOUR WAY</span>
      </div>

      <section className="story-section" id="story">
        <div className="story-image" role="img" aria-label="Coffee being prepared by hand" />
        <div className="story-copy">
          <p className="eyebrow eyebrow-light"><span /> THE KAPE AMORE WAY</p>
          <h2>A good cup<br />brings us <em>together.</em></h2>
          <p>Kape Amore is built around the simple things: coffee made with care, food worth sharing, and space to settle in.</p>
          <p>
            Whether you're catching up, getting things done, or simply taking a
            moment for yourself, there's a seat waiting here.
          </p>
          <a className="story-link" href="#visit">Come say hello <span aria-hidden="true">↗</span></a>
          <span className="story-mark" aria-hidden="true">KA / 01</span>
        </div>
      </section>

      <section className="visit-section section-pad" id="visit">
        <div className="visit-heading">
          <p className="eyebrow"><span /> STOP IN WHENEVER</p>
          <h2>Make room<br />for a <em>coffee break.</em></h2>
        </div>
        <div className="visit-details">
          <div className="visit-item">
            <span className="visit-index">01</span>
            <div>
              <h3>Come by</h3>
              <p>Drop in for a slow morning, a quick pick-me-up, or anything in between.</p>
              <span className="detail-note">Dine in · Take away · Delivery</span>
            </div>
          </div>
          <div className="visit-item">
            <span className="visit-index">02</span>
            <div>
              <h3>Stay a little</h3>
              <p>Bring a friend, bring a book, or just bring yourself. We’ll take care of the coffee.</p>
              <a className="detail-link" href="#story">A little about us <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#home">
          <img className="brand-logo" src="/images/kape-amore-logo.png" alt="" />
          <span className="wordmark-name"><span>KAPE <em>AMORE</em></span><small>COFFEE · FOOD · GOOD VIBES</small></span>
        </a>
        <p>A little coffee, a lot of heart.</p>
        <a className="back-top" href="#home">BACK TO TOP <span aria-hidden="true">↑</span></a>
        <span className="footer-copyright">© 2026 Kape Amore</span>
      </footer>
    </main>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/account/*" element={<RequireAuth excludeRole="admin"><AccountDashboard /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth role="admin"><AdminPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
