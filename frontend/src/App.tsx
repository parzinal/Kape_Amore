import { useState } from "react";
import { tw } from "./tw";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from "./auth/AuthPages";
import { RequireAuth } from "./auth/RouteGuards";
import { AdminDashboard } from "./dashboard/AdminDashboard";
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
      <header className={tw("site-header")}>
        <a className={tw("wordmark")} href="#home" aria-label="Kape Amore home" onClick={closeMenu}>
          <img className={tw("brand-logo")} src="/images/kape-amore-logo.png" alt="" />
          <span className={tw("wordmark-name")}><span>KAPE <em className={tw("wordmark-name-em")}>AMORE</em></span><small className={tw("wordmark-name-small")}>COFFEE · FOOD · GOOD VIBES</small></span>
        </a>

        <button
          className={tw(`menu-toggle ${menuOpen ? "is-open" : ""}`)}
          type="button"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className={tw(`menu-toggle-line ${menuOpen ? "menu-toggle-open-first" : ""}`)} />
          <span className={tw(`menu-toggle-line ${menuOpen ? "menu-toggle-open-last" : ""}`)} />
        </button>

        <nav className={tw(`main-nav ${menuOpen ? "main-nav-open" : ""}`)} aria-label="Main navigation">
          <a className={tw("main-nav-link")} href="#home" onClick={closeMenu}>Home</a>
          <a className={tw("main-nav-link")} href="#menu" onClick={closeMenu}>The menu</a>
          <a className={tw("main-nav-link")} href="#story" onClick={closeMenu}>Our story</a>
          <a className={tw("main-nav-link")} href="#visit" onClick={closeMenu}>Visit</a>
          <Link className={tw("nav-account-link")} to="/login" onClick={closeMenu}>Sign in</Link>
          <a className={tw("nav-cta")} href="#menu" onClick={closeMenu}>Order now <span aria-hidden="true">↗</span></a>
        </nav>
      </header>

      <section className={tw("hero")} id="home">
        <div className={tw("hero-image")} role="img" aria-label="A freshly made coffee on a café table" />
        <div className={tw("hero-copy")}>
          <p className={tw("hero-eyebrow")}><span className={tw("eyebrow-line")} /> COFFEE FOR EVERYDAY MOMENTS</p>
          <h1 className={tw("hero-title")}>Your daily<br />cup of <em className={tw("hero-title-accent")}>comfort.</em></h1>
          <p className={tw("hero-description")}>
            Specialty coffee, made fresh for your everyday moments. Come as
            you are; we’ll put the kettle on.
          </p>
          <div className={tw("hero-actions")}>
            <a className={tw("hero-button")} href="#menu">Order now <span aria-hidden="true">↗</span></a>
            <a className={tw("hero-view-link")} href="#menu">View menu <span className={tw("hero-link-arrow")} aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className={tw("hero-photo-caption")}>
          <span>POUR OVER</span>
          <span>BREWED TO ORDER</span>
        </div>
      </section>

      <section className={tw("menu-section section-pad")} id="menu">
        <div className={tw("section-heading")}>
          <div>
            <p className={tw("section-eyebrow")}><span className={tw("eyebrow-line")} /> A GOOD PLACE TO START</p>
            <h2 className={tw("section-title")}>Favorites from<br />the <em className={tw("section-title-accent")}>coffee bar.</em></h2>
          </div>
          <p className={tw("section-intro")}>
            The familiar ones, made properly. Find your usual—or make a new one.
          </p>
        </div>
        <div className={tw("menu-grid")}>
          {drinks.map((drink, index) => (
            <article className={tw("menu-card")} key={drink.name}>
              <div className={tw("menu-card-image")}>
                <img className={tw("menu-card-img")} src={drink.image} alt={drink.imageAlt} loading="lazy" />
                <span className={tw("menu-number")}>0{index + 1}</span>
              </div>
              <div className={tw("menu-card-details")}>
                <div className={tw("menu-card-copy")}>
                  <span className={tw("menu-tag")}>{drink.tag}</span>
                  <h3 className={tw("menu-card-title")}>{drink.name}</h3>
                  <p className={tw("menu-note")}>{drink.note}</p>
                </div>
                <span className={tw("menu-price")}>{drink.price}</span>
              </div>
            </article>
          ))}
        </div>
        <a className={tw("menu-more")} href="#visit">Visit Kape Amore <span aria-hidden="true">↗</span></a>
      </section>

      <div className={tw("service-strip")} aria-label="Ways to enjoy Kape Amore">
        <span className={tw("service-strip-item")}>01 <strong className={tw("service-strip-strong")}>DINE IN</strong></span>
        <span className={tw("service-strip-item")}>02 <strong className={tw("service-strip-strong")}>TAKE AWAY</strong></span>
        <span className={tw("service-strip-item")}>03 <strong className={tw("service-strip-strong")}>DELIVERY</strong></span>
        <span className={tw("service-strip-note")}>YOUR COFFEE, YOUR WAY</span>
      </div>

      <section className={tw("story-section")} id="story">
        <div className={tw("story-image")} role="img" aria-label="Coffee being prepared by hand" />
        <div className={tw("story-copy")}>
          <p className={tw("story-eyebrow")}><span className={tw("eyebrow-line")} /> THE KAPE AMORE WAY</p>
          <h2 className={tw("story-title")}>A good cup<br />brings us <em className={tw("story-title-accent")}>together.</em></h2>
          <p className={tw("story-paragraph")}>Kape Amore is built around the simple things: coffee made with care, food worth sharing, and space to settle in.</p>
          <p className={tw("story-paragraph")}>
            Whether you're catching up, getting things done, or simply taking a
            moment for yourself, there's a seat waiting here.
          </p>
          <a className={tw("story-link")} href="#visit">Come say hello <span className={tw("story-link-arrow")} aria-hidden="true">↗</span></a>
          <span className={tw("story-mark")} aria-hidden="true">KA / 01</span>
        </div>
      </section>

      <section className={tw("visit-section section-pad")} id="visit">
        <div className={tw("visit-heading")}>
          <p className={tw("visit-eyebrow")}><span className={tw("eyebrow-line")} /> STOP IN WHENEVER</p>
          <h2 className={tw("visit-title")}>Make room<br />for a <em className={tw("visit-title-accent")}>coffee break.</em></h2>
        </div>
        <div className={tw("visit-details")}>
          <div className={tw("visit-item")}>
            <span className={tw("visit-index")}>01</span>
            <div>
              <h3 className={tw("visit-item-title")}>Come by</h3>
              <p className={tw("visit-item-description")}>Drop in for a slow morning, a quick pick-me-up, or anything in between.</p>
              <span className={tw("detail-note")}>Dine in · Take away · Delivery</span>
            </div>
          </div>
          <div className={tw("visit-item")}>
            <span className={tw("visit-index")}>02</span>
            <div>
              <h3 className={tw("visit-item-title")}>Stay a little</h3>
              <p className={tw("visit-item-description")}>Bring a friend, bring a book, or just bring yourself. We’ll take care of the coffee.</p>
              <a className={tw("detail-link")} href="#story">A little about us <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <footer className={tw("site-footer")}>
        <a className={tw("wordmark footer-wordmark")} href="#home">
          <img className={tw("brand-logo")} src="/images/kape-amore-logo.png" alt="" />
          <span className={tw("wordmark-name")}><span>KAPE <em className={tw("wordmark-name-em")}>AMORE</em></span><small className={tw("wordmark-name-small")}>COFFEE · FOOD · GOOD VIBES</small></span>
        </a>
        <p className={tw("footer-copy")}>A little coffee, a lot of heart.</p>
        <a className={tw("back-top")} href="#home">BACK TO TOP <span aria-hidden="true">↑</span></a>
        <span className={tw("footer-copyright")}>© 2026 Kape Amore</span>
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
          <Route path="/admin/*" element={<RequireAuth role={["admin", "manager", "cashier", "staff"]} permission="dashboard.view"><AdminDashboard /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
