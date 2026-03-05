import { useEffect, useMemo, useState } from 'react';
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import http from './api/http';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
const API_ORIGIN = new URL(API_BASE, window.location.origin).origin;
const FLASK_ORIGIN = import.meta.env.VITE_FLASK_BASE_URL || 'http://localhost:5000';

const MEN_FILTERS = ['tshirt', 'shirts', 'jackets'];
const WOMEN_FILTERS = ['dresses', 'jackets', 'tops'];
const EMPTY_CART = { items: [], totalAmount: 0 };

const HOME_SLIDES = [
  {
    image: '/assets/mens/tshirts/tshirt-1.jpg',
    title: 'Elevated Everyday Fits',
    subtitle: 'AI-first styling with premium comfort.',
  },
  {
    image: '/assets/mens/jackets/jacket1.png',
    title: 'Smart Layered Looks',
    subtitle: 'Sharper silhouettes for modern wardrobes.',
  },
  {
    image: '/assets/women/tops/06429_00.jpg',
    title: 'Refined Minimal Elegance',
    subtitle: 'Beautiful staples designed to stand out.',
  },
];

const toAssetUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) return `${FLASK_ORIGIN}${path}`;
  return `${API_ORIGIN}${path}`;
};

const starsFromRating = (rating = 0) => {
  const rounded = Math.round(Number(rating) || 0);
  return '★'.repeat(Math.max(0, rounded)).padEnd(5, '☆');
};

const ORDER_STEPS = ['placed', 'processing', 'shipped', 'delivered'];

function ProtectedRoute({ token, children, message = 'Please login to access this feature.' }) {
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ protectedMessage: message, from: location.pathname }} />;
  }
  return children;
}

function AdminRoute({ token, user, children }) {
  const location = useLocation();
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ protectedMessage: 'Please login as admin.' }} />;
  }
  if (!user) {
    return <div className="mx-auto max-w-5xl px-4 pt-8">Loading admin profile...</div>;
  }
  if (user.role !== 'admin') {
    return <Navigate to="/" replace state={{ protectedMessage: 'Admin access required.', from: location.pathname }} />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <StoreApp />
    </BrowserRouter>
  );
}

function StoreApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState(localStorage.getItem('auth_token'));
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);
  const [orders, setOrders] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [message, setMessage] = useState('');

  const cartCount = useMemo(
    () => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [cart.items]
  );

  const loadMe = async () => {
    if (!token) {
      setUser(null);
      return;
    }
    const { data } = await http.get('/auth/me');
    setUser(data.user || null);
  };

  const loadFeatured = async () => {
    const { data } = await http.get('/products?limit=8');
    setFeatured(data.items || []);
  };

  const loadCart = async () => {
    if (!token) {
      setCart(EMPTY_CART);
      return;
    }
    const { data } = await http.get('/cart');
    setCart(data || EMPTY_CART);
  };

  const loadFavorites = async () => {
    if (!token) {
      setFavorites([]);
      return;
    }
    const { data } = await http.get('/favorites');
    setFavorites(data.items || []);
  };

  const loadOrders = async () => {
    if (!token) {
      setOrders([]);
      return;
    }
    const { data } = await http.get('/orders/my');
    setOrders(data.items || []);
  };

  useEffect(() => {
    loadFeatured().catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setCart(EMPTY_CART);
      setOrders([]);
      setFavorites([]);
      return;
    }

    Promise.all([loadMe(), loadCart(), loadFavorites(), loadOrders()]).catch(() => {
      localStorage.removeItem('auth_token');
      setToken(null);
      setMessage('Session expired. Please login again.');
    });
  }, [token]);

  useEffect(() => {
    if (!message) return undefined;
    const timeoutHandle = setTimeout(() => {
      setMessage('');
    }, 3000);
    return () => clearTimeout(timeoutHandle);
  }, [message]);

  const onAuthSuccess = (payload) => {
    localStorage.setItem('auth_token', payload.token);
    setToken(payload.token);
    setUser(payload.user || null);
    setMessage(payload.user?.role === 'admin' ? 'Admin login successful' : 'Logged in successfully');
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setCart(EMPTY_CART);
    setOrders([]);
    setFavorites([]);
    setMessage('Logged out');
    navigate('/login');
  };

  const isFavorite = (productId) => favorites.some((item) => item.product?._id === productId);

  const toggleFavorite = async (productId) => {
    if (!token) {
      setMessage('Please login to access this feature.');
      navigate('/login', { state: { protectedMessage: 'Please login to access this feature.' } });
      return;
    }

    try {
      const exists = isFavorite(productId);
      const { data } = exists
        ? await http.delete(`/favorites/${productId}`)
        : await http.post(`/favorites/${productId}`);
      setFavorites(data.items || []);
      setMessage(exists ? 'Removed from wishlist' : 'Saved to wishlist');
    } catch {
      setMessage('Unable to update wishlist right now.');
    }
  };

  const addToCart = async (productId, size = 'M') => {
    if (!token) {
      setMessage('Please login to access this feature.');
      navigate('/login', { state: { protectedMessage: 'Please login to access this feature.' } });
      return false;
    }

    try {
      const { data } = await http.post('/cart/items', { productId, size, quantity: 1 });
      setCart(data || EMPTY_CART);
      setMessage('Added to cart');
      return true;
    } catch {
      setMessage('Unable to add product to cart.');
      return false;
    }
  };

  const updateCartItem = async (itemId, action) => {
    try {
      const { data } = await http.patch(`/cart/items/${itemId}`, { action });
      setCart(data || EMPTY_CART);
    } catch {
      setMessage('Unable to update cart.');
    }
  };

  const removeCartItem = async (itemId) => {
    try {
      const { data } = await http.delete(`/cart/items/${itemId}`);
      setCart(data || EMPTY_CART);
    } catch {
      setMessage('Unable to remove item.');
    }
  };

  const checkout = async (paymentMethod, transactionRef, couponCode = '') => {
    const { data } = await http.post('/orders/checkout', { paymentMethod, transactionRef, couponCode });
    setMessage(data.message || 'Order placed successfully');
    await loadCart();
    await loadOrders();
    return data.order;
  };

  const hideNavbar = ['/login', '/register', '/admin/login', '/admin/register'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-black text-white">
      {!hideNavbar && (
        <header className="sticky top-0 z-50 border-b border-neutral-700 bg-black/95 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
            <Link to="/" className="text-xl font-bold tracking-wide text-white">Clothify AI</Link>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Link className="nav-link" to="/">Home</Link>
              <Link className="nav-link" to="/men">Men</Link>
              <Link className="nav-link" to="/women">Women</Link>
              <Link className="nav-link" to="/favorites">wishlist ({favorites.length})</Link>
              <Link className="nav-link" to="/cart">Cart ({cartCount})</Link>
              {token && <Link className="nav-link" to="/orders">Orders</Link>}
              {!token ? (
                <>
                  <Link className="nav-link" to="/login">Login</Link>
                  <Link className="nav-link" to="/register">Register</Link>
                  <Link className="nav-link" to="/admin/login">Admin Login</Link>
                </>
              ) : (
                <>
                  {user?.role === 'admin' && <Link className="nav-link" to="/admin">Admin Panel</Link>}
                  <button type="button" className="nav-link" onClick={logout}>Logout</button>
                </>
              )}
            </div>
          </nav>
        </header>
      )}

      {message && (
        <div className="fixed right-4 top-20 z-[60] w-[min(92vw,420px)] rounded-xl border border-neutral-500 bg-neutral-950 px-4 py-3 text-sm text-white shadow-2xl">
          {message}
        </div>
      )}

      <main className="pb-12">
        <Routes>
          <Route
            path="/"
            element={(
              <HomePage
                featured={featured}
                token={token}
                addToCart={addToCart}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}
          />
          <Route path="/login" element={<AuthPage mode="login" onSuccess={onAuthSuccess} />} />
          <Route path="/register" element={<AuthPage mode="register" onSuccess={onAuthSuccess} />} />
          <Route path="/admin/login" element={<AuthPage mode="login" adminMode onSuccess={onAuthSuccess} />} />
          <Route path="/admin/register" element={<AuthPage mode="register" adminMode onSuccess={onAuthSuccess} />} />

          <Route
            path="/men"
            element={(
              <CollectionPage
                gender="men"
                filters={MEN_FILTERS}
                token={token}
                addToCart={addToCart}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}
          />

          <Route
            path="/women"
            element={(
              <CollectionPage
                gender="women"
                filters={WOMEN_FILTERS}
                token={token}
                addToCart={addToCart}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}
          />

          <Route
            path="/product/:id"
            element={(
              <ProductDetailsPage
                token={token}
                addToCart={addToCart}
                toggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
            )}
          />

          <Route
            path="/favorites"
            element={(
              <ProtectedRoute token={token}>
                <FavoritesPage favorites={favorites} addToCart={addToCart} toggleFavorite={toggleFavorite} />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/cart"
            element={(
              <ProtectedRoute token={token}>
                <CartPage cart={cart} updateCartItem={updateCartItem} removeCartItem={removeCartItem} />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/checkout"
            element={(
              <ProtectedRoute token={token}>
                <CheckoutPage cart={cart} onCheckout={checkout} />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/orders"
            element={(
              <ProtectedRoute token={token}>
                <OrdersPage orders={orders} />
              </ProtectedRoute>
            )}
          />

          <Route
            path="/admin"
            element={(
              <AdminRoute token={token} user={user}>
                <AdminDashboard />
              </AdminRoute>
            )}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!hideNavbar && (
        <footer className="border-t border-neutral-700 bg-black py-6 text-center text-sm text-neutral-300">
          Clothify AI • Virtual Try-On Store • Powered by MERN + Flask AI
        </footer>
      )}
    </div>
  );
}

function HomePage({ featured, token, addToCart, toggleFavorite, isFavorite }) {
  const navigate = useNavigate();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HOME_SLIDES.length);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  const slide = HOME_SLIDES[activeSlide];

  return (
    <div className="mx-auto max-w-7xl px-4 pt-8">
      <section className="grid gap-6 rounded-3xl border border-neutral-700 bg-neutral-950 p-6 shadow-sm md:grid-cols-2">
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">Premium Virtual Fitting</p>
          <h1 className="text-4xl font-black leading-tight md:text-5xl">
            Try Clothes with AI,
            <span className="block text-neutral-200">Look Premium Instantly.</span>
          </h1>
          <p className="text-neutral-300">Upload your photo, preview outfits, get body measurements, and receive accurate size recommendations.</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/men" className="rounded-xl bg-white px-5 py-2 font-semibold text-black hover:bg-neutral-200">Shop Men</Link>
            <Link to="/women" className="rounded-xl border border-neutral-400 bg-transparent px-5 py-2 font-semibold hover:bg-neutral-900">Shop Women</Link>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-700 bg-neutral-900 p-3 shadow-sm">
          <img src={toAssetUrl(slide.image)} alt={slide.title} className="h-[320px] w-full rounded-xl object-cover" />
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-neutral-300">Featured</p>
          <h3 className="text-xl font-bold">{slide.title}</h3>
          <p className="text-sm text-neutral-300">{slide.subtitle}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-2xl font-bold">Featured Products</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.slice(0, 8).map((product) => (
            <article key={product._id} className="group rounded-2xl border border-neutral-700 bg-neutral-950 p-3 transition hover:-translate-y-1 hover:shadow-xl">
              <div className="overflow-hidden rounded-xl">
                <img src={toAssetUrl(product.image)} alt={product.name} className="h-64 w-full object-cover transition duration-300 group-hover:scale-105" />
              </div>
              <p className="mt-3 text-xs text-neutral-300">{product.brand}</p>
              <h3 className="line-clamp-1 font-semibold">{product.name}</h3>
              <p className="text-neutral-200">{starsFromRating(product.rating)} <span className="text-xs text-neutral-400">({product.rating})</span></p>
              <p className="text-xl font-bold text-white">₹{product.price}</p>
              <p className="text-xs text-neutral-300">Available: {Number(product.quantity || 0)}</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button type="button" className="rounded-xl border border-neutral-500 bg-neutral-900 px-2 py-2 text-xs text-white" onClick={() => toggleFavorite(product._id)}>
                  {isFavorite(product._id) ? '★ Saved' : '☆ Save'}
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-white px-2 py-2 text-xs font-semibold text-black"
                  onClick={() => {
                    if (!token) {
                      navigate('/login', { state: { protectedMessage: 'Please login to access this feature.' } });
                      return;
                    }
                    navigate(`/product/${product._id}`);
                  }}
                >
                  Try-On
                </button>
                <button type="button" className="rounded-xl border border-neutral-500 bg-black px-2 py-2 text-xs text-white" onClick={() => addToCart(product._id, 'M')}>
                  Add
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AuthPage({ mode, onSuccess, adminMode = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(location.state?.protectedMessage || '');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!form.password || form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = adminMode
        ? mode === 'login'
          ? '/auth/login-admin'
          : '/auth/register-admin'
        : mode === 'login'
          ? '/auth/login'
          : '/auth/register';
      const { data } = await http.post(endpoint, {
        email: form.email.trim(),
        password: form.password,
      });
      onSuccess(data);
      if (adminMode) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[85vh] max-w-5xl place-items-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-neutral-700 bg-neutral-950 p-6 backdrop-blur-xl">
        <h2 className="text-center text-2xl font-bold">
          {adminMode ? (mode === 'login' ? 'Admin Login' : 'Admin Register') : (mode === 'login' ? 'Welcome Back' : 'Create Account')}
        </h2>
        <p className="mt-1 text-center text-sm text-neutral-300">
          {adminMode
            ? (mode === 'login' ? 'Sign in to manage products and pricing' : 'Create an admin account')
            : (mode === 'login' ? 'Login to continue' : 'Register to unlock virtual try-on features')}
        </p>

        {error && <p className="mt-4 rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white">{error}</p>}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <input className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <input className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          {mode === 'register' && (
            <input className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} />
          )}
          <button className="w-full rounded-xl border border-white bg-white py-2 font-semibold text-black" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-300">
          {mode === 'login' ? 'No account?' : 'Already have an account?'}{' '}
          <Link
            className="font-semibold text-white underline"
            to={adminMode ? (mode === 'login' ? '/admin/register' : '/admin/login') : (mode === 'login' ? '/register' : '/login')}
          >
            {mode === 'login' ? 'Register' : 'Login'}
          </Link>
        </p>

        <p className="mt-2 text-center text-xs text-neutral-400">
          <Link className="underline" to={adminMode ? '/login' : '/admin/login'}>
            {adminMode ? 'User Login' : 'Admin Login'}
          </Link>
        </p>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [orderSavingId, setOrderSavingId] = useState('');
  const [infoOpenId, setInfoOpenId] = useState('');
  const [edits, setEdits] = useState({});
  const [orderEdits, setOrderEdits] = useState({});
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'percent',
    value: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    usageLimit: '',
    expiresAt: '',
  });
  const [form, setForm] = useState({
    name: '',
    brand: 'StyleHub',
    price: '',
    image: '',
    gender: 'women',
    category: 'dresses',
    quantity: '',
    sizes: 'S,M,L,XL',
  });

  const loadProducts = async () => {
    const { data } = await http.get('/products?limit=100');
    const items = data.items || [];
    setProducts(items);
    const nextEdits = {};
    items.forEach((item) => {
      nextEdits[item._id] = {
        price: String(item.price ?? ''),
        quantity: String(item.quantity ?? 0),
        image: String(item.image ?? ''),
      };
    });
    setEdits(nextEdits);
  };

  const loadAllOrders = async () => {
    const { data } = await http.get('/orders/admin');
    const items = data.items || [];
    setAllOrders(items);
    const nextStatus = {};
    items.forEach((order) => {
      nextStatus[order._id] = order.status;
    });
    setOrderEdits(nextStatus);
  };

  const loadCoupons = async () => {
    const { data } = await http.get('/coupons');
    setCoupons(data.items || []);
  };

  useEffect(() => {
    Promise.all([loadProducts(), loadAllOrders(), loadCoupons()]).catch(() => setStatus('Unable to load admin data.'));
  }, []);

  const onCreate = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.image.trim()) {
      setStatus('Name and image are required.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      await http.post('/products', {
        name: form.name.trim(),
        brand: form.brand.trim() || 'StyleHub',
        price: Number(form.price),
        image: form.image.trim(),
        gender: form.gender,
        category: form.category.trim().toLowerCase() || 'dresses',
        quantity: Math.max(Number(form.quantity) || 0, 0),
        sizes: form.sizes.split(',').map((size) => size.trim()).filter(Boolean),
      });

      setForm((prev) => ({
        ...prev,
        name: '',
        price: '',
        image: '',
        quantity: '',
      }));
      await loadProducts();
      setStatus('Product added successfully.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to add product.');
    } finally {
      setLoading(false);
    }
  };

  const updatePricingAndStock = async (productId) => {
    const edit = edits[productId] || {};
    setSavingId(productId);
    try {
      await http.patch(`/products/${productId}`, {
        price: Number(edit.price),
        quantity: Math.max(Number(edit.quantity) || 0, 0),
        image: String(edit.image || '').trim(),
      });
      setStatus('Product updated successfully.');
      await loadProducts();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to update product.');
    } finally {
      setSavingId('');
    }
  };

  const deleteProduct = async (productId) => {
    try {
      await http.delete(`/products/${productId}`);
      setStatus('Product deleted successfully.');
      await loadProducts();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to delete product.');
    }
  };

  const updateOrderStatus = async (orderId) => {
    setOrderSavingId(orderId);
    try {
      await http.patch(`/orders/${orderId}/status`, {
        status: orderEdits[orderId] || 'placed',
      });
      setStatus('Order status updated successfully.');
      await loadAllOrders();
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to update order status.');
    } finally {
      setOrderSavingId('');
    }
  };

  const createCoupon = async (event) => {
    event.preventDefault();
    if (!couponForm.code.trim() || !couponForm.value) {
      setStatus('Coupon code and value are required.');
      return;
    }

    setCouponLoading(true);
    try {
      await http.post('/coupons', {
        code: couponForm.code.trim(),
        type: couponForm.type,
        value: Number(couponForm.value),
        minOrderAmount: couponForm.minOrderAmount ? Number(couponForm.minOrderAmount) : 0,
        maxDiscountAmount: couponForm.maxDiscountAmount ? Number(couponForm.maxDiscountAmount) : null,
        usageLimit: couponForm.usageLimit ? Number(couponForm.usageLimit) : null,
        expiresAt: couponForm.expiresAt || null,
      });

      setCouponForm({
        code: '',
        type: 'percent',
        value: '',
        minOrderAmount: '',
        maxDiscountAmount: '',
        usageLimit: '',
        expiresAt: '',
      });
      await loadCoupons();
      setStatus('Coupon created successfully.');
    } catch (error) {
      setStatus(error.response?.data?.message || 'Unable to create coupon.');
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <h2 className="text-3xl font-black">Admin Panel</h2>
      <p className="mt-1 text-sm text-neutral-300">Add dresses and update product price/quantity.</p>

      <section className="mt-4 rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
        <h3 className="text-lg font-semibold">Add New Dress/Product</h3>
        <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" placeholder="Product name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" placeholder="Brand" value={form.brand} onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))} />
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" placeholder="Image URL or /assets path" value={form.image} onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))} />
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="number" min="0" placeholder="Price" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="number" min="0" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" placeholder="Sizes (comma separated)" value={form.sizes} onChange={(e) => setForm((p) => ({ ...p, sizes: e.target.value }))} />

          <select className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" value={form.gender} onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}>
            <option value="women">women</option>
            <option value="men">men</option>
          </select>
          <input className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" placeholder="Category (e.g. dresses)" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />

          <button className="md:col-span-2 rounded-xl border border-white bg-white px-4 py-2 font-semibold text-black" type="submit" disabled={loading}>
            {loading ? 'Adding...' : 'Add Product'}
          </button>
        </form>
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
        <h3 className="text-lg font-semibold">Manage Products (Price / Quantity / Image URL)</h3>
        <div className="mt-3 space-y-2">
          {products.map((item) => (
            <div key={item._id} className="rounded-xl border border-neutral-700 bg-black p-3">
              <div className="grid gap-2 md:grid-cols-[1fr_120px_120px_160px_100px_100px] md:items-center">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-neutral-300">{item.category} • {item.gender}</p>
                </div>
                <input
                  className="rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
                  type="number"
                  min="0"
                  value={edits[item._id]?.price ?? ''}
                  onChange={(e) => setEdits((prev) => ({
                    ...prev,
                    [item._id]: { ...prev[item._id], price: e.target.value },
                  }))}
                />
                <input
                  className="rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
                  type="number"
                  min="0"
                  value={edits[item._id]?.quantity ?? ''}
                  onChange={(e) => setEdits((prev) => ({
                    ...prev,
                    [item._id]: { ...prev[item._id], quantity: e.target.value },
                  }))}
                />
                <button
                  type="button"
                  className="rounded-xl border border-white bg-white px-3 py-2 font-semibold text-black"
                  disabled={savingId === item._id}
                  onClick={() => updatePricingAndStock(item._id)}
                >
                  {savingId === item._id ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-neutral-400 bg-neutral-900 px-3 py-2 font-semibold text-white"
                  onClick={() => setInfoOpenId((prev) => (prev === item._id ? '' : item._id))}
                >
                  Info
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-red-600 bg-red-600/20 px-3 py-2 font-semibold text-red-200"
                  onClick={() => deleteProduct(item._id)}
                >
                  Delete
                </button>
              </div>

              {infoOpenId === item._id && (
                <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
                  <img src={toAssetUrl(item.image)} alt={item.name} className="h-32 w-32 rounded-lg object-cover" />
                  <p className="mt-2 text-xs text-neutral-300">Product ID: {item._id}</p>
                  <label className="mt-2 block text-xs text-neutral-300">Image URL</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
                    type="text"
                    value={edits[item._id]?.image ?? ''}
                    onChange={(e) => setEdits((prev) => ({
                      ...prev,
                      [item._id]: { ...prev[item._id], image: e.target.value },
                    }))}
                  />
                  <p className="mt-1 text-[11px] text-neutral-400">Update URL above and click Save.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
        <h3 className="text-lg font-semibold">Manage Order Status</h3>
        <div className="mt-3 space-y-2">
          {allOrders.map((order) => (
            <div key={order._id} className="grid gap-2 rounded-xl border border-neutral-700 bg-black p-3 md:grid-cols-[1fr_220px_170px] md:items-center">
              <div>
                <p className="font-semibold">{order.user?.email || 'User'}</p>
                <p className="text-xs text-neutral-300">Order: {order._id}</p>
                <p className="text-xs text-neutral-300">Total: ₹{order.totalAmount}</p>
              </div>
              <select
                className="rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-white"
                value={orderEdits[order._id] || 'placed'}
                onChange={(e) => setOrderEdits((prev) => ({ ...prev, [order._id]: e.target.value }))}
              >
                <option value="placed">placed</option>
                <option value="processing">processing</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
              </select>
              <button
                type="button"
                className="rounded-xl border border-white bg-white px-3 py-2 font-semibold text-black"
                disabled={orderSavingId === order._id}
                onClick={() => updateOrderStatus(order._id)}
              >
                {orderSavingId === order._id ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
        <h3 className="text-lg font-semibold">Coupon & Discount Management</h3>
        <form className="mt-3 grid gap-2 md:grid-cols-3" onSubmit={createCoupon}>
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            placeholder="Code (e.g. SAVE20)"
            value={couponForm.code}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
          />
          <select
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            value={couponForm.type}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            <option value="percent">percent</option>
            <option value="fixed">fixed</option>
          </select>
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            type="number"
            min="1"
            placeholder="Value"
            value={couponForm.value}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, value: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            type="number"
            min="0"
            placeholder="Min order amount"
            value={couponForm.minOrderAmount}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, minOrderAmount: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            type="number"
            min="0"
            placeholder="Max discount (optional)"
            value={couponForm.maxDiscountAmount}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, maxDiscountAmount: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            type="number"
            min="1"
            placeholder="Usage limit (optional)"
            value={couponForm.usageLimit}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, usageLimit: e.target.value }))}
          />
          <input
            className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white md:col-span-2"
            type="datetime-local"
            value={couponForm.expiresAt}
            onChange={(e) => setCouponForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
          />
          <button className="rounded-xl border border-white bg-white px-3 py-2 font-semibold text-black" type="submit" disabled={couponLoading}>
            {couponLoading ? 'Creating...' : 'Create Coupon'}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {coupons.map((coupon) => (
            <div key={coupon._id} className="grid gap-2 rounded-xl border border-neutral-700 bg-black p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
              <div>
                <p className="font-semibold">{coupon.code}</p>
                <p className="text-xs text-neutral-300">
                  {coupon.type === 'percent' ? `${coupon.value}% off` : `₹${coupon.value} off`} • Min ₹{coupon.minOrderAmount || 0}
                </p>
              </div>
              <p className="text-xs text-neutral-300">Used: {coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</p>
              <p className="text-xs text-neutral-300">{coupon.expiresAt ? `Expires: ${new Date(coupon.expiresAt).toLocaleDateString()}` : 'No Expiry'}</p>
              <span className="rounded-full border border-neutral-500 bg-neutral-900 px-3 py-1 text-xs uppercase text-white">
                {coupon.isActive ? 'active' : 'inactive'}
              </span>
            </div>
          ))}
          {coupons.length === 0 && <p className="text-sm text-neutral-300">No coupons created yet.</p>}
        </div>
      </section>

      {status && <p className="mt-4 rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white">{status}</p>}
    </div>
  );
}

function CollectionPage({ gender, filters, token, addToCart, toggleFavorite, isFavorite }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState(filters);
  const [sortBy, setSortBy] = useState('highToLow');
  const [sizes, setSizes] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    http
      .get(`/products?gender=${gender}&limit=50`)
      .then(({ data }) => setProducts(data.items || []))
      .catch(() => setError('Unable to load products right now.'));
  }, [gender]);

  useEffect(() => {
    const category = (searchParams.get('category') || '').toLowerCase();
    if (!category) {
      setSelectedCategories(filters);
      return;
    }
    const normalized = category === 'tshirts' ? 'tshirt' : category;
    if (filters.includes(normalized)) {
      setSelectedCategories([normalized]);
    }
  }, [searchParams, filters]);

  const visibleProducts = useMemo(() => {
    const scoped = products.filter((item) => selectedCategories.includes(item.category));
    return scoped.sort((a, b) =>
      sortBy === 'highToLow' ? Number(b.price) - Number(a.price) : Number(a.price) - Number(b.price)
    );
  }, [products, selectedCategories, sortBy]);

  const onTryOn = (productId) => {
    if (!token) {
      setError('Please login to use Virtual Try-On.');
      navigate('/login', { state: { protectedMessage: 'Please login to use Virtual Try-On.' } });
      return;
    }
    navigate(`/product/${productId}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <div className="mb-4 rounded-2xl border border-neutral-700 bg-neutral-950 p-5 backdrop-blur-xl">
        <h2 className="text-3xl font-black">{gender === 'men' ? 'Men Collection' : 'Women Collection'}</h2>
        <p className="text-neutral-300">Choose styles, save favorites, and launch instant try-on.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-neutral-700 bg-neutral-950 p-4 backdrop-blur-xl">
          <h3 className="mb-3 font-semibold">Filters</h3>
          <div className="space-y-2 text-sm">
            {filters.map((category) => (
              <label className="flex items-center gap-2" key={category}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() =>
                    setSelectedCategories((prev) =>
                      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
                    )
                  }
                />
                <span className="capitalize">{category}</span>
              </label>
            ))}
          </div>

          <h4 className="mt-4 font-semibold">Price</h4>
          <div className="mt-2 space-y-1 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={sortBy === 'highToLow'} onChange={() => setSortBy('highToLow')} />
              High to Low
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={sortBy === 'lowToHigh'} onChange={() => setSortBy('lowToHigh')} />
              Low to High
            </label>
          </div>
        </aside>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleProducts.map((product) => (
            <article key={product._id} className="group rounded-2xl border border-neutral-700 bg-neutral-950 p-3 backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-xl">
              <div className="overflow-hidden rounded-xl">
                <img src={toAssetUrl(product.image)} alt={product.name} className="h-72 w-full object-cover transition duration-300 group-hover:scale-105" />
              </div>
              <p className="mt-3 text-xs text-neutral-300">{product.brand}</p>
              <h3 className="line-clamp-1 text-lg font-semibold">{product.name}</h3>
              <p className="text-sm text-neutral-200">{starsFromRating(product.rating)} <span className="text-neutral-300">({product.rating})</span></p>
              <p className="text-2xl font-bold text-white">₹{product.price}</p>
              <p className="text-xs text-neutral-300">Available: {Number(product.quantity || 0)}</p>
              <p className="text-xs text-neutral-300">Sizes: {(product.sizes || []).join(', ')}</p>

              <select
                className="mt-2 w-full rounded-xl border border-neutral-600 bg-black px-2 py-2 text-white"
                value={sizes[product._id] || ''}
                onChange={(event) => setSizes((prev) => ({ ...prev, [product._id]: event.target.value }))}
              >
                <option value="">Select size</option>
                {(product.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl border border-neutral-500 bg-neutral-900 px-2 py-2 text-sm text-white" onClick={() => toggleFavorite(product._id)}>
                  {isFavorite(product._id) ? '★ Saved' : '☆ Save'}
                </button>
                <button type="button" className="rounded-xl bg-white px-2 py-2 text-sm font-semibold text-black" onClick={() => onTryOn(product._id)}>
                  Quick Try-On
                </button>
                <button type="button" className="col-span-2 rounded-xl border border-neutral-500 bg-black px-2 py-2 text-sm text-white" onClick={() => addToCart(product._id, sizes[product._id] || 'M')}>
                  Add to Cart
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>

      {visibleProducts.length === 0 && <p className="mt-4 text-neutral-200">No products found for selected filters.</p>}
      {error && <p className="mt-4 rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white">{error}</p>}
    </div>
  );
}

function ProductDetailsPage({ token, addToCart, toggleFavorite, isFavorite }) {
  const navigate = useNavigate();
  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [selectedSize, setSelectedSize] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [result, setResult] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectUploadPercent, setSelectUploadPercent] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [moreClothes, setMoreClothes] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: '5', comment: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('');

  useEffect(() => {
    http
      .get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch(() => setError('Unable to load product details.'));
  }, [id]);

  const loadReviews = async () => {
    const { data } = await http.get(`/products/${id}/reviews`);
    setReviews(data.items || []);
  };

  useEffect(() => {
    loadReviews().catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    if (!product?.gender) return;
    http
      .get(`/products?gender=${product.gender}&limit=8`)
      .then(({ data }) => {
        const items = (data.items || []).filter((item) => item._id !== product._id);
        setMoreClothes(items.slice(0, 6));
      })
      .catch(() => setMoreClothes([]));
  }, [product?._id, product?.gender]);

  const toProductFile = async () => {
    const response = await fetch(toAssetUrl(product.image));
    if (!response.ok) {
      throw new Error('Unable to load clothing image for try-on.');
    }
    const blob = await response.blob();
    return new File([blob], 'clothing-image.jpg', { type: blob.type || 'image/jpeg' });
  };

  const runTryOn = async () => {
    if (!token) {
      setError('Please login to use Virtual Try-On.');
      navigate('/login', { state: { protectedMessage: 'Please login to use Virtual Try-On.' } });
      return;
    }

    if (!avatarFile) {
      setError('Please upload a clear photo.');
      return;
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(avatarFile.type)) {
      setError('Only JPG, JPEG, and PNG files are allowed.');
      return;
    }

    if (avatarFile.size > 5 * 1024 * 1024) {
      setError('Image size should be 5MB or smaller.');
      return;
    }

    setError('');
    setResult(null);
    setShowInfo(false);
    setProcessing(true);
    setUploadProgress(0);
    setStep(3);

    try {
      const clothingFile = await toProductFile();

      const tryOnForm = new FormData();
      tryOnForm.append('clothing_image', clothingFile);
      tryOnForm.append('avatar_image', avatarFile);

      const tryOnResponse = await http.post('/inference/try-on', tryOnForm, {
        timeout: 180000,
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || 0;
          if (total > 0) {
            const percent = Math.min(100, Math.round((progressEvent.loaded * 100) / total));
            setUploadProgress(percent);
          }
        },
      });

      const payload = tryOnResponse.data || {};
      if (!payload.success) {
        throw new Error(payload.error || 'Unable to process image. Please try another photo.');
      }

      const imagePath = payload.result_image;
      if (!imagePath) {
        throw new Error('No output image returned by AI service.');
      }

      const prediction = {
        estimated_size: payload.estimated_size || payload.recommended_size || 'N/A',
        recommended_size: payload.recommended_size || payload.estimated_size || 'N/A',
        gender: (() => {
          const rawGender = (payload.gender || payload.predicted_gender || '').toString().toLowerCase();
          if (rawGender === 'male' || rawGender === 'female') return rawGender;
          const maleProb = Number(payload.gender_probabilities?.male ?? 50);
          const femaleProb = Number(payload.gender_probabilities?.female ?? 50);
          return maleProb >= femaleProb ? 'male' : 'female';
        })(),
        gender_confidence: Number(payload.gender_confidence ?? payload.confidence ?? 0),
        measurements: {
          height_cm: payload.height ?? payload.measurements?.height_cm ?? null,
          chest_cm: payload.chest ?? payload.measurements?.chest_cm ?? null,
          waist_cm: payload.waist ?? payload.measurements?.waist_cm ?? null,
          hip_cm: payload.hip ?? payload.measurements?.hip_cm ?? null,
        },
      };

      setResult({
        imageUrl: toAssetUrl(imagePath),
        prediction,
        selectedSize: prediction.estimated_size || prediction.recommended_size || 'N/A',
      });

      setShowInfo(true);
      setUploadProgress(100);
      setStep(4);
    } catch (runError) {
      const isTimeout = runError?.code === 'ECONNABORTED' || String(runError?.message || '').toLowerCase().includes('timeout');
      setError(
        (isTimeout
          ? 'Upload is taking longer than expected. Please wait and try again in a moment.'
          : null) ||
        runError?.response?.data?.error ||
        runError?.response?.data?.message ||
        runError?.message ||
        'Unable to process image. Please try another photo.'
      );
      setStep(2);
      setUploadProgress(0);
    } finally {
      setProcessing(false);
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();

    if (!token) {
      setReviewStatus('Please login to submit a review.');
      navigate('/login', { state: { protectedMessage: 'Please login to submit a review.' } });
      return;
    }

    setReviewLoading(true);
    setReviewStatus('');
    try {
      await http.post(`/products/${id}/reviews`, {
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
      });

      const { data: productData } = await http.get(`/products/${id}`);
      setProduct(productData);
      await loadReviews();
      setReviewForm((prev) => ({ ...prev, comment: '' }));
      setReviewStatus('Review submitted successfully.');
    } catch (requestError) {
      setReviewStatus(requestError.response?.data?.message || 'Unable to submit review.');
    } finally {
      setReviewLoading(false);
    }
  };

  if (!product) {
    return <div className="mx-auto max-w-5xl px-4 pt-8">Loading product...</div>;
  }

  const measurements = result?.prediction?.measurements || {};
  const genderRaw = (result?.prediction?.gender || 'male').toString().toLowerCase();
  const genderLabel = genderRaw === 'female' ? 'Female' : 'Male';
  const genderConfidence = Number(result?.prediction?.gender_confidence ?? 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <section className="grid gap-6 rounded-3xl border border-neutral-700 bg-neutral-950 p-5 shadow-sm lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900">
          <img src={toAssetUrl(product.image)} alt={product.name} className="h-[520px] w-full object-cover" />
        </div>

        <div>
          <p className="text-sm uppercase tracking-widest text-neutral-300">{product.brand}</p>
          <h2 className="text-3xl font-black">{product.name}</h2>
          <p className="mt-1 text-neutral-200">{starsFromRating(product.rating)} <span className="text-neutral-400">({product.rating})</span></p>
          <p className="mt-3 text-3xl font-bold text-white">₹{product.price}</p>
          <p className="text-sm text-neutral-300">Available: {Number(product.quantity || 0)}</p>
          <p className="text-sm text-neutral-300">Available sizes: {(product.sizes || []).join(', ')}</p>

          <label className="mt-4 block text-sm">Select Size</label>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(product.sizes || ['S', 'M', 'L', 'XL']).map((size) => {
              const selected = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  className={selected
                    ? 'rounded-xl border border-neutral-900 bg-neutral-900 px-3 py-2 text-sm text-white'
                    : 'rounded-xl border border-neutral-400 bg-white px-3 py-2 text-sm text-black hover:bg-neutral-200'}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-sm">Upload Photo</label>
          <input
            className="mt-1 w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0] || null;
              setAvatarFile(selectedFile);
              setSelectUploadPercent(0);
              setResult(null);
              setShowInfo(false);
              if (selectedFile) {
                setStep(2);
                setError('');

                const fileReader = new FileReader();
                fileReader.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const percent = Math.min(100, Math.round((event.loaded * 100) / event.total));
                    setSelectUploadPercent(percent);
                  }
                };
                fileReader.onloadend = () => setSelectUploadPercent(100);
                fileReader.readAsArrayBuffer(selectedFile);
              }
            }}
          />

          {avatarFile && (
            <div className="mt-3 rounded-xl border border-neutral-700 bg-black p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-200">
                <span>Photo Upload</span>
                <span>{selectUploadPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-700">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${selectUploadPercent}%` }} />
              </div>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-neutral-700 bg-black p-3 text-xs text-neutral-300">
            <p className={step >= 1 ? 'text-white' : ''}>Step 1: Upload your photo.</p>
            <p className={step >= 2 ? 'text-white' : ''}>Step 2: Click process to start AI analysis.</p>
            <p className={step >= 3 ? 'text-white' : ''}>Step 3: Wait while we process virtual try-on.</p>
            <p className={step >= 4 ? 'text-white' : ''}>Step 4: View result and measurements below.</p>
          </div>

          {processing && (
            <div className="mt-3 rounded-xl border border-neutral-700 bg-black p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-neutral-200">
                <span>Try-On Processing Upload</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-700">
                <div className="h-2 rounded-full bg-white transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" className="rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-white" onClick={() => toggleFavorite(product._id)}>
              {isFavorite(product._id) ? '★ Saved' : '☆ Save'}
            </button>
            <button type="button" className="rounded-xl border border-neutral-500 bg-black px-3 py-2 text-white" onClick={() => addToCart(product._id, selectedSize || 'M')}>
              Add to Cart
            </button>
            <button
              type="button"
              className="col-span-2 rounded-xl border border-white bg-white px-3 py-2 font-semibold text-black"
              disabled={processing || !avatarFile}
              onClick={runTryOn}
            >
              {processing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Processing Image...
                </span>
              ) : 'Process Virtual Try-On'}
            </button>
          </div>

          {error && <p className="mt-4 rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-sm text-white">{error}</p>}
        </div>
      </section>

      {result && (
        <section className="mt-6 rounded-3xl border border-neutral-700 bg-neutral-950 p-5 shadow-sm">
          <h3 className="text-2xl font-bold">Virtual Try-On Result</h3>
          <img src={result.imageUrl} alt="Try-on result" className="mt-4 h-[420px] w-full rounded-2xl object-contain bg-black" />

          <div className="mt-4 rounded-2xl border border-neutral-700 bg-black p-4">
            <div className="flex items-center gap-3">
              <img src={toAssetUrl(product.image)} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
              <div>
                <p className="text-lg font-semibold">{product.name}</p>
                <p className="text-sm text-neutral-300">Estimated Size: {result.selectedSize}</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-3 rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-2 text-sm text-white"
              onClick={() => setShowInfo((prev) => !prev)}
            >
              {showInfo ? 'Hide Info' : 'Info'}
            </button>

            {showInfo && (
              <>
                <h4 className="mt-4 text-lg font-semibold">Estimated Measurements</h4>
                <p className="mt-2 text-sm text-neutral-200">
                  Gender: {genderLabel}{Number.isFinite(genderConfidence) && genderConfidence > 0 ? ` (${genderConfidence.toFixed(1)}%)` : ''}
                </p>
                <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                  <p>Height: {measurements.height_cm ?? 'N/A'} cm</p>
                  <p>Chest: {measurements.chest_cm ?? 'N/A'} cm</p>
                  <p>Waist: {measurements.waist_cm ?? 'N/A'} cm</p>
                  <p>Hip: {measurements.hip_cm ?? 'N/A'} cm</p>
                </div>

                <p className="mt-3 text-base font-bold text-white">Recommended Size: {result.prediction.estimated_size || 'N/A'}</p>
              </>
            )}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-neutral-700 bg-neutral-950 p-5 shadow-sm">
        <h4 className="text-xl font-bold">Verified Buyer Reviews</h4>

        <form className="mt-3 grid gap-2" onSubmit={submitReview}>
          <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
            <select
              className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
              value={reviewForm.rating}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, rating: e.target.value }))}
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Very Good</option>
              <option value="3">3 - Good</option>
              <option value="2">2 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
            <input
              className="rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
              type="text"
              maxLength={300}
              placeholder="Write your review (verified buyers only)"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((prev) => ({ ...prev, comment: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="w-fit rounded-xl border border-white bg-white px-4 py-2 font-semibold text-black"
            disabled={reviewLoading}
          >
            {reviewLoading ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>

        {reviewStatus && (
          <p className="mt-2 rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white">{reviewStatus}</p>
        )}

        <div className="mt-4 space-y-2">
          {reviews.map((review) => (
            <article key={review._id} className="rounded-xl border border-neutral-700 bg-black p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{review.user?.email || 'User'}</p>
                <p className="text-sm text-neutral-300">{starsFromRating(review.rating)} ({review.rating})</p>
              </div>
              {review.verifiedBuyer && (
                <p className="mt-1 text-xs uppercase tracking-wide text-emerald-300">Verified Buyer</p>
              )}
              <p className="mt-2 text-sm text-neutral-200">{review.comment || 'No comment provided.'}</p>
            </article>
          ))}
          {reviews.length === 0 && <p className="text-sm text-neutral-300">No reviews yet.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border border-neutral-700 bg-neutral-950 p-5 shadow-sm">
        <h5 className="text-base font-semibold">More Clothes</h5>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moreClothes.map((item) => (
            <article key={item._id} className="rounded-xl border border-neutral-700 bg-black p-2">
              <img src={toAssetUrl(item.image)} alt={item.name} className="h-36 w-full rounded-lg object-cover" />
              <p className="mt-2 line-clamp-1 text-sm font-semibold">{item.name}</p>
              <p className="text-xs text-neutral-300">₹{item.price}</p>
              <div className="mt-2 grid grid-cols-3 gap-1">
                <button type="button" className="rounded-lg border border-neutral-500 bg-neutral-900 px-2 py-1 text-[11px] text-white" onClick={() => toggleFavorite(item._id)}>Save</button>
                <button type="button" className="rounded-lg bg-white px-2 py-1 text-[11px] text-black" onClick={() => navigate(`/product/${item._id}`)}>Try</button>
                <button type="button" className="rounded-lg border border-neutral-500 bg-black px-2 py-1 text-[11px] text-white" onClick={() => addToCart(item._id, 'M')}>Add</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function FavoritesPage({ favorites, addToCart, toggleFavorite }) {
  const [sizes, setSizes] = useState({});

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6">
      <h2 className="mb-4 text-3xl font-black">Your Wishlist</h2>
      {favorites.length === 0 && <p className="text-neutral-300">No saved products yet.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {favorites.map((entry) => {
          const product = entry.product;
          if (!product) return null;

          return (
            <article key={entry._id} className="rounded-2xl border border-neutral-700 bg-neutral-950 p-3 backdrop-blur-xl">
              <img src={toAssetUrl(product.image)} alt={product.name} className="h-72 w-full rounded-xl object-cover" />
              <h3 className="mt-3 text-lg font-semibold">{product.name}</h3>
              <p className="text-neutral-300">₹{product.price}</p>
              <select className="mt-2 w-full rounded-xl border border-neutral-600 bg-black px-2 py-2 text-white" value={sizes[product._id] || ''} onChange={(e) => setSizes((p) => ({ ...p, [product._id]: e.target.value }))}>
                <option value="">Select size</option>
                {(product.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="rounded-xl border border-neutral-500 bg-black px-3 py-2 text-white" onClick={() => addToCart(product._id, sizes[product._id] || 'M')}>Add</button>
                <button type="button" className="rounded-xl bg-white px-3 py-2 text-black" onClick={() => toggleFavorite(product._id)}>Remove</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function CartPage({ cart, updateCartItem, removeCartItem }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h2 className="mb-4 text-3xl font-black">Shopping Cart</h2>
      {cart.items.length === 0 && <p className="text-neutral-300">Your cart is empty.</p>}

      <div className="space-y-3">
        {cart.items.map((item) => (
          <article key={item._id} className="grid gap-3 rounded-2xl border border-neutral-700 bg-neutral-950 p-4 backdrop-blur-xl md:grid-cols-[90px_1fr_auto] md:items-center">
            <img src={toAssetUrl(item.product?.image)} alt={item.product?.name || 'product'} className="h-20 w-20 rounded-xl object-cover" />
            <div>
              <h3 className="font-semibold">{item.product?.name}</h3>
              <p className="text-sm text-neutral-300">Size: {item.size}</p>
              <p className="text-sm text-neutral-300">Quantity: {item.quantity}</p>
              <p className="text-sm text-neutral-300">Subtotal: ₹{item.subtotal}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-1 text-white" onClick={() => updateCartItem(item._id, 'inc')}>+</button>
              <button type="button" className="rounded-xl border border-neutral-500 bg-neutral-900 px-3 py-1 text-white" onClick={() => updateCartItem(item._id, 'dec')}>-</button>
              <button type="button" className="rounded-xl bg-white px-3 py-1 text-black" onClick={() => removeCartItem(item._id)}>Remove</button>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-5 text-2xl font-bold text-white">Total: ₹{cart.totalAmount || 0}</p>
      <Link to="/checkout" className="mt-4 inline-block rounded-xl border border-white bg-white px-5 py-2 font-semibold text-black">
        Proceed to Checkout
      </Link>
    </div>
  );
}

function CheckoutPage({ cart, onCheckout }) {
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [transactionRef, setTransactionRef] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [status, setStatus] = useState('');

  const subtotal = Number(cart.totalAmount || 0);
  const discountAmount = Number(couponInfo?.discountAmount || 0);
  const finalTotal = Math.max(subtotal - discountAmount, 0);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setStatus('Enter coupon code first.');
      return;
    }

    setApplyingCoupon(true);
    try {
      const { data } = await http.post('/coupons/validate', {
        code: couponCode.trim(),
        subtotal,
      });
      setCouponInfo(data);
      setStatus(`Coupon ${data.code} applied successfully.`);
    } catch (error) {
      setCouponInfo(null);
      setStatus(error.response?.data?.message || 'Invalid coupon code.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const placeOrder = async () => {
    if (!cart.items.length) {
      setStatus('Cart is empty.');
      return;
    }
    try {
      await onCheckout(paymentMethod, transactionRef, couponCode.trim());
      setStatus('Order placed successfully.');
      setTransactionRef('');
      setCouponCode('');
      setCouponInfo(null);
    } catch (error) {
      setStatus(error.response?.data?.message || 'Checkout failed.');
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 pt-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-neutral-700 bg-neutral-950 p-5 backdrop-blur-xl">
        <h2 className="text-3xl font-black">Secure Checkout</h2>
        <div className="mt-4 space-y-3">
          <select className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="COD">Cash on Delivery</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
          </select>
          <input className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white" type="text" placeholder="Transaction ref (UPI/Card)" value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="w-full rounded-xl border border-neutral-600 bg-black px-3 py-2 text-white"
              type="text"
              placeholder="Coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <button type="button" className="rounded-xl border border-neutral-400 bg-neutral-900 px-3 py-2 text-white" onClick={applyCoupon} disabled={applyingCoupon}>
              {applyingCoupon ? 'Applying...' : 'Apply'}
            </button>
          </div>
          <button type="button" className="w-full rounded-xl border border-white bg-white px-3 py-2 font-semibold text-black" onClick={placeOrder}>Pay Now</button>
        </div>
        {status && <p className="mt-4 rounded-xl border border-neutral-600 bg-neutral-900 px-3 py-2 text-sm text-white">{status}</p>}
      </section>

      <section className="rounded-3xl border border-neutral-700 bg-neutral-950 p-5 backdrop-blur-xl">
        <h3 className="text-2xl font-bold">Order Summary</h3>
        <div className="mt-4 space-y-2">
          {cart.items.map((item) => (
            <div key={item._id} className="flex items-center gap-3 rounded-xl border border-neutral-700 bg-black p-2">
              <img src={toAssetUrl(item.product?.image)} alt={item.product?.name || 'product'} className="h-14 w-14 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{item.product?.name}</p>
                <p className="text-xs text-neutral-300">Size: {item.size} • Qty: {item.quantity}</p>
              </div>
              <p className="font-semibold">₹{item.subtotal}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 text-sm text-neutral-300">
          <p>Subtotal: ₹{subtotal}</p>
          <p>Discount: ₹{discountAmount}</p>
        </div>
        <p className="mt-1 text-2xl font-bold text-white">Estimated Total: ₹{finalTotal}</p>
      </section>
    </div>
  );
}

function OrdersPage({ orders }) {
  const [itemRatings, setItemRatings] = useState({});
  const [itemComments, setItemComments] = useState({});
  const [itemMessages, setItemMessages] = useState({});
  const [ratingLoadingKey, setRatingLoadingKey] = useState('');

  const getItemKey = (orderId, item, idx) => `${orderId}-${item.product}-${item.size}-${idx}`;

  const submitItemRating = async (orderId, item, idx) => {
    const key = getItemKey(orderId, item, idx);
    const rawValue = itemRatings[key] ?? '';
    const numericRating = Number(rawValue);
    const productId = typeof item.product === 'string' ? item.product : item.product?._id;

    if (!productId) {
      setItemMessages((prev) => ({ ...prev, [key]: 'Invalid product reference.' }));
      return;
    }

    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      setItemMessages((prev) => ({ ...prev, [key]: 'Rating must be between 1 and 5.' }));
      return;
    }

    if (Math.round(numericRating * 10) !== numericRating * 10) {
      setItemMessages((prev) => ({ ...prev, [key]: 'Use up to 1 decimal place only (e.g. 3.2).' }));
      return;
    }

    setRatingLoadingKey(key);
    try {
      await http.post(`/products/${productId}/reviews`, {
        rating: numericRating,
        comment: String(itemComments[key] || '').trim(),
      });
      setItemMessages((prev) => ({ ...prev, [key]: 'Rating saved successfully.' }));
    } catch (error) {
      setItemMessages((prev) => ({
        ...prev,
        [key]: error.response?.data?.message || 'Unable to submit rating.',
      }));
    } finally {
      setRatingLoadingKey('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6">
      <h2 className="mb-4 text-3xl font-black">My Orders</h2>
      {orders.length === 0 && <p className="text-neutral-300">No orders yet.</p>}

      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order._id} className="rounded-2xl border border-neutral-700 bg-neutral-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-neutral-300">Order ID: {order._id}</p>
              <span className="rounded-full border border-neutral-500 bg-black px-3 py-1 text-xs uppercase text-white">
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-300">Payment: {order.paymentMethod}</p>
            <p className="mt-1 text-sm text-neutral-300">Subtotal: ₹{order.subtotalAmount || order.totalAmount}</p>
            <p className="mt-1 text-sm text-neutral-300">Discount: ₹{order.discountAmount || 0} {order.couponCode ? `(Coupon: ${order.couponCode})` : ''}</p>
            <p className="mt-1 text-sm text-neutral-300">Total: ₹{order.totalAmount}</p>

            {order.status !== 'cancelled' ? (
              <div className="mt-3 rounded-xl border border-neutral-700 bg-black p-3">
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {ORDER_STEPS.map((step, index) => {
                    const currentIndex = ORDER_STEPS.indexOf(order.status);
                    const active = currentIndex >= index;
                    return (
                      <div key={`${order._id}-${step}`} className="space-y-1">
                        <div className={active ? 'mx-auto h-3 w-3 rounded-full bg-white' : 'mx-auto h-3 w-3 rounded-full bg-neutral-600'} />
                        <p className={active ? 'text-white' : 'text-neutral-500'}>{step}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-neutral-700">
                  <div
                    className="h-1 rounded-full bg-white"
                    style={{ width: `${((Math.max(ORDER_STEPS.indexOf(order.status), 0) + 1) / ORDER_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">This order has been cancelled.</p>
            )}

            <div className="mt-3 space-y-2">
              {(order.items || []).map((item, idx) => (
                <div key={`${order._id}-${item.product}-${idx}`} className="rounded-xl border border-neutral-700 bg-black p-2 text-sm">
                  <div className="flex items-center justify-between">
                    <p>{item.name} • Size {item.size}</p>
                    <p>Qty: {item.quantity}</p>
                  </div>

                  {order.status === 'delivered' && (
                    <div className="mt-2 rounded-lg border border-neutral-700 bg-neutral-950 p-2">
                      <p className="text-xs text-emerald-300">Delivered order: you can rate this item.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr_120px]">
                        <input
                          className="rounded-lg border border-neutral-600 bg-black px-2 py-2 text-white"
                          type="number"
                          min="1"
                          max="5"
                          step="0.1"
                          placeholder="e.g. 4.5"
                          value={itemRatings[getItemKey(order._id, item, idx)] ?? ''}
                          onChange={(e) => setItemRatings((prev) => ({
                            ...prev,
                            [getItemKey(order._id, item, idx)]: e.target.value,
                          }))}
                        />
                        <input
                          className="rounded-lg border border-neutral-600 bg-black px-2 py-2 text-white"
                          type="text"
                          maxLength={300}
                          placeholder="Optional comment"
                          value={itemComments[getItemKey(order._id, item, idx)] ?? ''}
                          onChange={(e) => setItemComments((prev) => ({
                            ...prev,
                            [getItemKey(order._id, item, idx)]: e.target.value,
                          }))}
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-white bg-white px-3 py-2 font-semibold text-black"
                          disabled={ratingLoadingKey === getItemKey(order._id, item, idx)}
                          onClick={() => submitItemRating(order._id, item, idx)}
                        >
                          {ratingLoadingKey === getItemKey(order._id, item, idx) ? 'Saving...' : 'Rate'}
                        </button>
                      </div>
                      {itemMessages[getItemKey(order._id, item, idx)] && (
                        <p className="mt-2 text-xs text-neutral-300">{itemMessages[getItemKey(order._id, item, idx)]}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default App;
