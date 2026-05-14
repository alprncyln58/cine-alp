import { useState, useEffect, useRef, type FormEvent, type MouseEvent } from 'react';
import { Search, Play, X, Info, ChevronLeft, ChevronRight, Film, Heart, LogOut, History, Plus, Check, Eye, EyeOff, Loader2, CheckSquare } from 'lucide-react';

// --- FIREBASE İMPORTLARI ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  type User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from "firebase/firestore";

// --- FIREBASE AYARLARI ---
// --- FIREBASE AYARLARI ---
const firebaseConfig = {
  apiKey: "AIzaSyCVeQ-Rj8Kx-YAJtEZs7bqzLkr2hwQrNlo",
  authDomain: "gen-lang-client-0259328350.firebaseapp.com",
  projectId: "gen-lang-client-0259328350",
  storageBucket: "gen-lang-client-0259328350.firebasestorage.app",
  messagingSenderId: "632827008516",
  appId: "1:632827008516:web:a612a17fe4d257df458751",
  measurementId: "G-ZDYLM2DQCV"
};

// Firebase Başlatma
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- TİP TANIMLAMALARI ---
interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  original_language?: string;
}

interface UserProfile {
  uid: string;
  name: string;
  surname: string;
  email: string;
  avatar: string;
}

interface Genre {
  id: number | string;
  name: string;
  url?: string;
}

// --- AYARLAR VE SABİTLER ---
const DIRECT_API_KEY = "5ce0f456cb4bc3a7c6a9e7dd5b954ff0"; 

const GENRES: Genre[] = [
  { id: 'trending', name: '🔥 Trendler', url: '/trending/all/week' },
  { id: 'top_rated', name: '⭐ IMDb Top 250', url: '/movie/top_rated' },
  { id: 28, name: 'Aksiyon' },
  { id: 12, name: 'Macera' },
  { id: 16, name: 'Animasyon' },
  { id: 35, name: 'Komedi' },
  { id: 878, name: 'Bilim Kurgu' },
  { id: 18, name: 'Dram' },
  { id: 27, name: 'Korku' },
  { id: 80, name: 'Suç' },
  { id: 10751, name: 'Aile' },
  { id: 14, name: 'Fantastik' },
];

export default function App() {
  // --- STATE TANIMLAMALARI ---
  const [query, setQuery] = useState<string>('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState<boolean>(false);
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [page, setPage] = useState<number>(1);
  
  const [heroMovie, setHeroMovie] = useState<Movie | null>(null);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<string | number>('trending');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  
  // Üyelik Sistemi State'leri (Firebase)
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showProfileMenu, setShowProfileMenu] = useState<boolean>(false);
  
  // Form State'leri
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [captchaVerified, setCaptchaVerified] = useState<boolean>(false);

  // Kullanıcı Listeleri
  const [myList, setMyList] = useState<Movie[]>([]);
  const [watchHistory, setWatchHistory] = useState<Movie[]>([]);

  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // --- BAŞLANGIÇ AYARLARI ---
  useEffect(() => {
    // Scroll dinleyicisi
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);

    // Firebase Auth Dinleyicisi (Kullanıcı giriş çıkışını takip eder)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Kullanıcı giriş yaptıysa Firestore'dan profilini ve listelerini çek
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserProfile(data.profile as UserProfile);
          setMyList(data.myList || []);
          setWatchHistory(data.watchHistory || []);
        }
      } else {
        // Çıkış yapıldıysa temizle
        setUserProfile(null);
        setMyList([]);
        setWatchHistory([]);
      }
    });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      unsubscribe();
    };
  }, []);

  // --- API İŞLEMLERİ ---
  
  // Kategori veya Arama değiştiğinde
  useEffect(() => {
    if (activeCategory === 'mylist') {
      setMovies(myList);
      return;
    }
    if (activeCategory === 'history') {
      setMovies(watchHistory);
      return;
    }

    setPage(1); 
    
    if (query.trim().length > 0) {
        // Arama yapılıyor
    } else {
        fetchContent(1); 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, myList, watchHistory]); 

  // Arama Debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim().length > 0) {
        setPage(1);
        searchMovies(1);
      } else if (query.trim().length === 0 && movies.length === 0) {
         fetchContent(1);
      }
    }, 500);
    return () => clearTimeout(delayDebounceFn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const fetchContent = async (pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const category = GENRES.find(c => c.id === activeCategory);
      if (!category) return;

      let url = '';
      if (category.url) {
        url = `https://api.themoviedb.org/3${category.url}?api_key=${DIRECT_API_KEY}&language=tr-TR&page=${pageNum}`;
      } else {
        url = `https://api.themoviedb.org/3/discover/movie?api_key=${DIRECT_API_KEY}&with_genres=${activeCategory}&language=tr-TR&sort_by=popularity.desc&page=${pageNum}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const results: Movie[] = data.results || [];
      
      if (pageNum === 1) {
        setMovies(results);
        if (activeCategory === 'trending' || !heroMovie) {
            const validBackdrops = results.filter(m => m.backdrop_path);
            if (validBackdrops.length > 0) {
              setHeroMovie(validBackdrops[Math.floor(Math.random() * Math.min(5, validBackdrops.length))]);
            }
        }
      } else {
        setMovies(prev => [...prev, ...results]);
      }
      
    } catch (error) {
      console.error("API Hatası:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const searchMovies = async (pageNum: number) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${DIRECT_API_KEY}&language=tr-TR&query=${query}&page=${pageNum}`);
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = data.results.filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv');
      
      if (pageNum === 1) {
        setMovies(results);
      } else {
        setMovies(prev => [...prev, ...results]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    
    if (query.trim().length > 0) {
        searchMovies(nextPage);
    } else {
        fetchContent(nextPage);
    }
  };

  // --- FIREBASE AUTHENTICATION (KAYIT & GİRİŞ) ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setAuthError('');
  };

  // KAYIT OL
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    if (formData.password !== formData.confirmPassword) {
      setAuthError('Şifreler eşleşmiyor.');
      setAuthLoading(false);
      return;
    }
    if (formData.password.length < 6) {
      setAuthError('Şifre en az 6 karakter olmalıdır.');
      setAuthLoading(false);
      return;
    }
    if (!captchaVerified) {
      setAuthError('Lütfen robot olmadığınızı doğrulayın.');
      setAuthLoading(false);
      return;
    }

    try {
      // 1. Firebase Auth ile kullanıcı oluştur
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // 2. Profil ismini güncelle
      await updateProfile(user, {
        displayName: `${formData.name} ${formData.surname}`
      });

      // 3. Firestore Veritabanına kullanıcı verilerini kaydet
      const avatarUrl = `https://ui-avatars.com/api/?name=${formData.name}+${formData.surname}&background=db0000&color=fff`;
      const newProfile: UserProfile = {
        uid: user.uid,
        name: formData.name,
        surname: formData.surname,
        email: formData.email,
        avatar: avatarUrl
      };

      await setDoc(doc(db, "users", user.uid), {
        profile: newProfile,
        myList: [],
        watchHistory: []
      });

      setUserProfile(newProfile);
      setShowAuthModal(false);
      resetForm();

    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setAuthError('Bu e-posta adresi zaten kullanımda.');
      } else {
        setAuthError('Kayıt olurken bir hata oluştu: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // GİRİŞ YAP
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      await signInWithEmailAndPassword(auth, formData.email, formData.password);
      setShowAuthModal(false);
      resetForm();
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/invalid-credential') {
        setAuthError('E-posta veya şifre hatalı.');
      } else {
        setAuthError('Giriş başarısız: ' + error.message);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowProfileMenu(false);
      setActiveCategory('trending');
    } catch (error) {
      console.error("Çıkış hatası:", error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', surname: '', email: '', password: '', confirmPassword: '' });
    setCaptchaVerified(false);
  };

  // --- LİSTE YÖNETİMİ (FIREBASE) ---
  const toggleMyList = async (movie: Movie, e?: MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    const exists = myList.some(m => m.id === movie.id);
    let newList = [];

    // Önce UI'ı güncelle (Hızlı tepki için)
    if (exists) {
      newList = myList.filter(m => m.id !== movie.id);
    } else {
      newList = [movie, ...myList];
    }
    setMyList(newList);

    // Sonra Veritabanını Güncelle
    const userDocRef = doc(db, "users", user.uid);
    try {
      if (exists) {
        await updateDoc(userDocRef, {
          myList: arrayRemove(movie) // Tam eşleşme gerekir, bazen obje referansı sorunu olabilir. 
          // Not: Basit arrayRemove obje için bazen çalışmayabilir, en garantisi tüm listeyi set etmektir ama trafik yer.
          // Burada daha sağlam olması için tüm listeyi güncelliyoruz:
        });
        // arrayRemove objelerde sorun çıkarabildiği için garanti yöntem:
        await setDoc(userDocRef, { myList: newList }, { merge: true }); 
      } else {
        await updateDoc(userDocRef, {
          myList: arrayUnion(movie)
        });
      }
    } catch (err) {
      console.error("Liste güncellenemedi:", err);
    }
  };

  const addToHistory = async (movie: Movie) => {
    if (!user) return;
    
    // UI Güncelle
    const filtered = watchHistory.filter(m => m.id !== movie.id);
    const newHistory = [movie, ...filtered];
    setWatchHistory(newHistory);

    // DB Güncelle
    const userDocRef = doc(db, "users", user.uid);
    try {
      // Geçmiş sürekli değiştiği için tüm array'i güncellemek daha sağlıklıdır
      await setDoc(userDocRef, { watchHistory: newHistory }, { merge: true });
    } catch (err) {
      console.error("Geçmiş kaydedilemedi:", err);
    }
  };

  // --- UI YARDIMCILARI ---
  const handleMovieClick = (movie: Movie) => {
    setSelectedMovie(movie);
    setIsPlaying(false);
  };

  const startVideo = () => {
    setIsPlaying(true);
    if (selectedMovie) {
        addToHistory(selectedMovie);
    }
  };

  const getVideoSource = (movie: Movie | null) => {
    if (!movie) return "";
    const type = movie.media_type === 'tv' || (!movie.media_type && !movie.title) ? 'tv' : 'movie'; 
    const id = movie.id;
    return `https://vidsrc.to/embed/${type}/${id}`;
  };

  const getImage = (path?: string, size = 'original') => path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

  const getYear = (movie: Movie) => {
     return movie.release_date?.split('-')[0] || movie.first_air_date?.split('-')[0] || '';
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      const { current } = categoryScrollRef;
      const scrollAmount = 300;
      current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const isInList = (movieId: number) => myList.some(m => m.id === movieId);

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans selection:bg-red-600 selection:text-white pb-10">
      
      {/* --- HEADER --- */}
      <header className={`fixed top-0 w-full z-[60] transition-all duration-300 flex flex-col ${scrolled || isMobileSearchOpen ? 'bg-[#141414]/95 backdrop-blur-xl shadow-lg shadow-black/50' : 'bg-gradient-to-b from-black via-black/80 to-transparent'}`}>
        <div className="px-4 md:px-10 h-16 flex items-center justify-between">
          
          {/* LOGO */}
          <div className="flex flex-col cursor-pointer select-none" onClick={() => {setActiveCategory('trending'); setQuery(''); setIsMobileSearchOpen(false);}}>
            <div className="text-2xl md:text-3xl font-black text-red-600 tracking-tighter flex items-center gap-1 hover:scale-105 transition">
              CINE<span className="text-white">ALP</span>
            </div>
          </div>
          
          {/* SAĞ TARAF */}
          <div className="flex gap-4 items-center">
            
            {/* MOBİL ARAMA İKONU */}
            <button 
                onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                className="md:hidden text-white hover:text-red-500 transition"
            >
               {isMobileSearchOpen ? <X size={24} /> : <Search size={24} />}
            </button>

            {/* MASAÜSTÜ ARAMA */}
            <div className={`hidden md:flex items-center bg-black/40 border ${query ? 'border-red-600' : 'border-white/20'} rounded-full px-3 py-1.5 transition-all duration-300 focus-within:border-red-600 w-64 backdrop-blur-sm`}>
              <Search className="text-gray-400 w-4 h-4" />
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İçerik ara..." className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 ml-2 w-full" />
              {query && <button onClick={() => setQuery('')}><X className="text-gray-400 w-4 h-4" /></button>}
            </div>

            {/* Profil */}
            {user && userProfile ? (
              <div className="relative">
                <div onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 cursor-pointer hover:bg-white/10 p-1.5 rounded-full transition">
                  <img src={userProfile.avatar} alt="Profile" className="w-8 h-8 rounded" />
                  <span className="text-sm font-medium hidden md:block">{userProfile.name}</span>
                </div>
                {showProfileMenu && (
                   <div className="absolute right-0 top-12 w-48 bg-[#181818] border border-gray-700 rounded-lg shadow-xl py-2 animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-4 py-2 border-b border-gray-700 mb-2">
                        <p className="text-xs text-gray-400">Hoşgeldin,</p>
                        <p className="font-bold truncate">{userProfile.name} {userProfile.surname}</p>
                      </div>
                      <button onClick={() => {setActiveCategory('mylist'); setShowProfileMenu(false); setIsMobileSearchOpen(false);}} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 text-sm"><Heart size={16} /> Listem ({myList.length})</button>
                      <button onClick={() => {setActiveCategory('history'); setShowProfileMenu(false); setIsMobileSearchOpen(false);}} className="w-full text-left px-4 py-2 hover:bg-gray-700 flex items-center gap-2 text-sm"><History size={16} /> Geçmiş</button>
                      <div className="border-t border-gray-700 my-1"></div>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-red-900/30 text-red-500 flex items-center gap-2 text-sm"><LogOut size={16} /> Çıkış Yap</button>
                   </div>
                )}
              </div>
            ) : (
              <button onClick={() => {setShowAuthModal(true); setAuthMode('login');}} className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-bold transition">Giriş Yap</button>
            )}
          </div>
        </div>

        {/* --- MOBİL ARAMA INPUTU --- */}
        {isMobileSearchOpen && (
          <div className="md:hidden px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
             <div className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                <Search className="text-gray-400 w-5 h-5" />
                <input 
                  type="text" 
                  value={query} 
                  onChange={(e) => setQuery(e.target.value)} 
                  placeholder="CineAlp'te ara..." 
                  className="bg-transparent border-none outline-none text-white placeholder-gray-500 ml-2 w-full"
                  autoFocus
                />
                {query && <button onClick={() => setQuery('')}><X className="text-gray-400 w-5 h-5" /></button>}
             </div>
          </div>
        )}

        {/* Kategoriler */}
        {!query && (
          <div className="relative px-4 md:px-10 pb-3 group w-full border-b border-white/5">
            <div className="flex items-center">
              <button onClick={() => scrollCategories('left')} className="absolute left-0 z-20 bg-gradient-to-r from-[#141414] to-transparent px-4 h-full hidden md:flex items-center opacity-0 group-hover:opacity-100 transition"><ChevronLeft size={24} /></button>
              <div ref={categoryScrollRef} className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth w-full pr-4 md:pr-0">
                {GENRES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all duration-200 border ${activeCategory === cat.id ? 'bg-white text-black border-white font-bold shadow-md' : 'bg-white/10 text-gray-300 border-transparent hover:bg-white/20 hover:text-white'}`}>{cat.name}</button>
                ))}
                {user && (
                  <>
                    <button onClick={() => setActiveCategory('mylist')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs md:text-sm font-medium border flex items-center gap-1 ${activeCategory === 'mylist' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 border-transparent'}`}>Listem</button>
                    <button onClick={() => setActiveCategory('history')} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs md:text-sm font-medium border flex items-center gap-1 ${activeCategory === 'history' ? 'bg-white text-black' : 'bg-white/10 text-gray-300 border-transparent'}`}>Geçmiş</button>
                  </>
                )}
              </div>
              <button onClick={() => scrollCategories('right')} className="absolute right-0 z-20 bg-gradient-to-l from-[#141414] to-transparent px-4 h-full hidden md:flex items-center opacity-0 group-hover:opacity-100 transition"><ChevronRight size={24} /></button>
            </div>
          </div>
        )}
      </header>

      {/* --- AUTH MODAL --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-black border border-white/10 rounded-lg w-full max-w-md relative shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 pb-2">
               <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition"><X /></button>
               <h2 className="text-3xl font-bold mb-1">{authMode === 'login' ? 'Oturum Aç' : 'Kayıt Ol'}</h2>
               {authError && (
                 <div className="bg-red-500/10 border border-red-500 text-red-500 text-xs p-3 rounded mt-4 flex items-center gap-2">
                   <Info size={16} /> {authError}
                 </div>
               )}
            </div>
            
            <div className="p-6 pt-2 overflow-y-auto custom-scrollbar">
              <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
                {authMode === 'register' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input type="text" name="name" required placeholder="Adınız" value={formData.name} onChange={handleInputChange} className="w-full bg-[#333] rounded px-4 py-3 text-white placeholder-gray-400 focus:bg-[#444] outline-none border border-transparent focus:border-white/20 transition text-sm" />
                    </div>
                    <div>
                      <input type="text" name="surname" required placeholder="Soyadınız" value={formData.surname} onChange={handleInputChange} className="w-full bg-[#333] rounded px-4 py-3 text-white placeholder-gray-400 focus:bg-[#444] outline-none border border-transparent focus:border-white/20 transition text-sm" />
                    </div>
                  </div>
                )}
                <div>
                  <input type="email" name="email" required placeholder="E-posta adresi" value={formData.email} onChange={handleInputChange} className="w-full bg-[#333] rounded px-4 py-3 text-white placeholder-gray-400 focus:bg-[#444] outline-none border border-transparent focus:border-white/20 transition text-sm" />
                </div>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} name="password" required placeholder="Parola" value={formData.password} onChange={handleInputChange} className="w-full bg-[#333] rounded px-4 py-3 text-white placeholder-gray-400 focus:bg-[#444] outline-none border border-transparent focus:border-white/20 transition text-sm pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-white">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {authMode === 'register' && (
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} name="confirmPassword" required placeholder="Parolayı Doğrula" value={formData.confirmPassword} onChange={handleInputChange} className={`w-full bg-[#333] rounded px-4 py-3 text-white placeholder-gray-400 focus:bg-[#444] outline-none border transition text-sm ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500' : 'border-transparent focus:border-white/20'}`} />
                  </div>
                )}
                {authMode === 'register' && (
                   <div onClick={() => setCaptchaVerified(!captchaVerified)} className="bg-[#f9f9f9] border border-[#d3d3d3] rounded p-2 flex items-center gap-3 cursor-pointer w-fit pr-8 select-none">
                      <div className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center transition ${captchaVerified ? 'border-transparent' : 'border-[#c1c1c1] bg-white'}`}>
                         {captchaVerified && <CheckSquare className="text-green-600 w-7 h-7" />}
                      </div>
                      <span className="text-[#222] text-sm font-medium">Ben robot değilim</span>
                      <div className="flex flex-col items-center ml-4">
                         <img src="https://www.gstatic.com/recaptcha/api2/logo_48.png" className="w-5 h-5 opacity-60" alt="captcha" />
                         <span className="text-[8px] text-[#555]">reCAPTCHA</span>
                      </div>
                   </div>
                )}
                <button type="submit" disabled={authLoading} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-900 disabled:cursor-not-allowed text-white font-bold py-3 rounded mt-2 transition flex justify-center items-center gap-2">
                  {authLoading && <Loader2 className="animate-spin" size={20} />}
                  {authMode === 'login' ? 'Oturum Aç' : 'Kayıt Ol'}
                </button>
              </form>

              <div className="mt-6 text-gray-400 text-sm text-center">
                {authMode === 'login' ? (
                  <>cinealp'e yeni misiniz? <button onClick={() => {setAuthMode('register'); setAuthError('');}} className="text-white hover:underline ml-1 font-medium">Şimdi kaydolun.</button></>
                ) : (
                  <>Zaten üye misiniz? <button onClick={() => {setAuthMode('login'); setAuthError('');}} className="text-white hover:underline ml-1 font-medium">Oturum açın.</button></>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- HERO SECTION --- */}
      {!query && heroMovie && activeCategory !== 'mylist' && activeCategory !== 'history' && (
        <div className="relative h-[70vh] md:h-[85vh] w-full animate-in fade-in duration-700">
          <div className="absolute inset-0">
             <img src={getImage(heroMovie.backdrop_path, 'original') || ''} alt="Hero" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-r from-[#141414] via-[#141414]/30 to-transparent"></div>
             <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/10 to-transparent"></div>
          </div>

          <div className="absolute bottom-[25%] left-4 md:left-10 max-w-3xl space-y-5 z-10">
            <h1 className="text-4xl md:text-7xl font-black drop-shadow-2xl leading-none tracking-tight">{heroMovie.title || heroMovie.name}</h1>
            <p className="text-sm md:text-xl text-gray-100 drop-shadow-lg line-clamp-3 font-medium">{heroMovie.overview}</p>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={() => handleMovieClick(heroMovie)} className="bg-white text-black px-8 py-3 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 font-bold text-lg shadow-lg">
                <Play fill="currentColor" size={24} /> Oynat
              </button>
              <button onClick={(e) => toggleMyList(heroMovie, e)} className="bg-gray-600/60 text-white px-6 py-3 rounded-lg hover:bg-gray-600/40 backdrop-blur-md transition flex items-center gap-2 font-bold text-lg border border-white/10">
                {isInList(heroMovie.id) ? <Check size={24} /> : <Plus size={24} />} Listem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ANA İÇERİK --- */}
      <div className={`px-4 md:px-10 min-h-screen transition-all duration-500 ${!query && heroMovie && activeCategory !== 'mylist' && activeCategory !== 'history' ? '-mt-24 relative z-20' : 'pt-36'}`}>
        
        {/* Başlıklar */}
        {query && <div className="flex items-center gap-2 mb-6 text-gray-400"><Search size={20} className="text-red-500" /><span className="text-white font-bold text-2xl">"{query}"</span> sonuçları</div>}
        {activeCategory === 'mylist' && <div className="flex items-center gap-2 mb-6 text-gray-400"><Heart size={20} className="text-red-500" /><span className="text-white font-bold text-2xl">Listem</span></div>}
        {activeCategory === 'history' && <div className="flex items-center gap-2 mb-6 text-gray-400"><History size={20} className="text-red-500" /><span className="text-white font-bold text-2xl">İzleme Geçmişi</span></div>}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-pulse">
            {[...Array(12)].map((_, i) => <div key={i} className="aspect-[2/3] bg-gray-800 rounded-lg"></div>)}
          </div>
        ) : (
          <>
            {movies.length === 0 ? (
               <div className="text-center py-24 text-gray-500 flex flex-col items-center gap-4">
                 <Film size={64} className="opacity-20" />
                 <p className="text-2xl font-light">Burada henüz bir içerik yok.</p>
                 {activeCategory === 'mylist' && <p className="text-sm">Filmleri beğenerek listenize ekleyebilirsiniz.</p>}
               </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10">
                  {movies.map((movie) => (
                    <div key={movie.id} onClick={() => handleMovieClick(movie)} className="group cursor-pointer flex flex-col gap-2 relative">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-all duration-300 group-hover:scale-105 group-hover:shadow-2xl group-hover:z-30">
                        <img src={movie.poster_path ? getImage(movie.poster_path, 'w500') || '' : "https://via.placeholder.com/500x750?text=No+Poster"} alt={movie.title} className="w-full h-full object-cover" loading="lazy" />
                        
                        {/* Yıl Etiketi */}
                        {getYear(movie) && (
                            <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg z-20">
                                {getYear(movie)}
                            </div>
                        )}

                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                           <div className="bg-white p-3 rounded-full shadow-lg transform scale-0 group-hover:scale-100 transition duration-300 hover:bg-gray-200">
                              <Play fill="black" size={24} className="text-black ml-1" />
                           </div>
                           <div className="flex gap-2">
                             <button onClick={(e) => toggleMyList(movie, e)} className="p-2 rounded-full border-2 border-gray-400 hover:border-white hover:bg-white/20 transition text-white" title="Listeme Ekle">
                                {isInList(movie.id) ? <Check size={16} /> : <Plus size={16} />}
                             </button>
                           </div>
                        </div>
                        {movie.vote_average !== undefined && movie.vote_average > 0 && (
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-green-400 border border-green-500/30">
                            {movie.vote_average.toFixed(1)}
                          </div>
                        )}
                      </div>
                      <div className="px-1 mt-1">
                         <h3 className="text-sm font-medium text-gray-200 truncate group-hover:text-red-500 transition-colors">{movie.title || movie.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>

                {/* DAHA FAZLA GÖSTER BUTONU */}
                {activeCategory !== 'mylist' && activeCategory !== 'history' && (
                    <div className="w-full flex justify-center py-10">
                        <button 
                            onClick={handleLoadMore} 
                            disabled={loadingMore}
                            className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-full font-bold transition flex items-center gap-2 disabled:opacity-50"
                        >
                            {loadingMore ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                            {loadingMore ? 'Yükleniyor...' : 'Daha Fazla Göster'}
                        </button>
                    </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* --- DETAY MODALI --- */}
      {selectedMovie && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#181818] w-full max-w-6xl h-[90vh] rounded-xl overflow-hidden shadow-2xl relative flex flex-col ring-1 ring-white/10">
            <button onClick={() => setSelectedMovie(null)} className="absolute top-4 right-4 z-50 bg-black/60 text-white p-2 rounded-full hover:bg-red-600 hover:text-white transition backdrop-blur-md group"><X size={24} className="group-hover:rotate-90 transition duration-300" /></button>

            {isPlaying ? (
              <div className="w-full h-full bg-black" >
                 <iframe src={getVideoSource(selectedMovie)} className="w-full h-full" allowFullScreen  allow="autoplay; encrypted-media" title="Player"></iframe>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                <div className="relative h-[55vh] shrink-0 w-full">
                  <img src={getImage(selectedMovie.backdrop_path || selectedMovie.poster_path, 'original') || ''} className="w-full h-full object-cover" alt="cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-transparent to-transparent"></div>
                  
                  <div className="absolute bottom-0 left-0 p-6 md:p-12 w-full z-10 flex flex-col gap-4">
                     <h2 className="text-4xl md:text-6xl font-black text-white drop-shadow-2xl leading-none tracking-tight">{selectedMovie.title || selectedMovie.name}</h2>
                     <div className="flex items-center gap-4 mt-2">
                       <button onClick={startVideo} className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 hover:scale-105 transition transform flex items-center gap-3 shadow-xl shadow-red-900/40 text-lg">
                         <Play fill="currentColor" size={24} /> HEMEN İZLE
                       </button>
                       <button onClick={(e) => toggleMyList(selectedMovie, e)} className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-3 rounded-lg font-bold hover:bg-white/20 transition flex items-center gap-2">
                         {isInList(selectedMovie.id) ? <Check size={24} /> : <Plus size={24} />}
                       </button>
                     </div>
                  </div>
                </div>

                <div className="p-6 md:p-12 grid md:grid-cols-[2fr_1fr] gap-10 bg-[#181818] flex-grow">
                   <div>
                     <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><Info size={20} className="text-red-500" /> Özet</h3>
                     <p className="text-gray-300 leading-relaxed text-lg font-light">{selectedMovie.overview || "Özet bulunamadı."}</p>
                   </div>
                   <div className="space-y-4 bg-[#202020] p-6 rounded-xl h-fit border border-white/5">
                      <div className="flex justify-between items-center border-b border-gray-700 pb-3"><span className="text-gray-400 text-sm">Yıl</span><span className="text-white font-medium">{selectedMovie.release_date?.split('-')[0] || selectedMovie.first_air_date?.split('-')[0]}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-700 pb-3"><span className="text-gray-400 text-sm">Dil</span><span className="uppercase text-white font-medium bg-white/10 px-2 py-0.5 rounded text-xs">{selectedMovie.original_language}</span></div>
                      <div className="flex justify-between items-center"><span className="text-gray-400 text-sm">Puan</span><span className="text-green-400 font-bold">{selectedMovie.vote_average?.toFixed(1)}</span></div>
                   </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- FOOTER --- */}
      <footer className="py-8 text-center text-gray-500 text-xs mt-12 border-t border-gray-800 bg-[#141414]">
        <p>&copy; 2025 <span className="text-red-600 font-bold">cinealp</span>. Tüm hakları saklıdır.</p>
        <p className="mt-2 flex items-center justify-center gap-2">Geliştirici: <span className="text-white font-medium border border-gray-700 px-2 py-0.5 rounded bg-gray-800">Alperen Ceylan</span></p>
      </footer>
    </div>
  );
}