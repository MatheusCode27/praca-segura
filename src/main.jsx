import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TreePine, Menu, X, MapPin, ClipboardList, Star, Info, Plus, Camera, Search, ChevronRight, ShieldCheck, Users, CheckCircle2, Clock3, Wrench, AlertTriangle, LayoutDashboard, LogOut, Leaf, Trash2, Lightbulb, Accessibility, MoreHorizontal } from 'lucide-react';
import './style.css';
import { supabase } from './supabase';

const categories = [
  { value: 'Iluminação', icon: Lightbulb, help: 'Poste apagado, lâmpada quebrada ou pouca iluminação.' },
  { value: 'Limpeza e lixo', icon: Trash2, help: 'Acúmulo de lixo, lixeira danificada ou falta de limpeza.' },
  { value: 'Equipamentos danificados', icon: Wrench, help: 'Bancos, brinquedos ou estruturas que precisam de reparo.' },
  { value: 'Acessibilidade', icon: Accessibility, help: 'Calçadas, rampas ou acessos com problemas.' },
  { value: 'Vandalismo', icon: AlertTriangle, help: 'Danos ao patrimônio ou estruturas públicas.' },
  { value: 'Outro', icon: MoreHorizontal, help: 'Outro problema relacionado à conservação da praça.' }
];

const initialReports = [];

const readReports = () => {
  try {
    const saved = localStorage.getItem('praca-segura-reports');
    return saved ? JSON.parse(saved) : initialReports;
  } catch {
    return initialReports;
  }
};

function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetPassword(true);
      }

      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadPlazas = async () => {
      setPlazasLoading(true);
      setPlazasError('');

      const { data, error } = await supabase
        .from('plazas')
        .select('id, name, address, description, bairro, tipo, latitude, longitude')
        .order('name', { ascending: true });

      if (error) {
        setPlazasError('Não foi possível carregar as praças. ' + error.message);
      } else {
        setPlazas(data || []);

        if (data?.length) {
          setForm(current => ({
            ...current,
            plazaId: current.plazaId || data[0].id
          }));
        }
      }

      setPlazasLoading(false);
    };

    loadPlazas();
  }, []);

  const [plazas, setPlazas] = useState([]);
  const [plazasLoading, setPlazasLoading] = useState(true);
  const [plazasError, setPlazasError] = useState('');
  const [reports, setReports] = useState([]);
  const [page, setPage] = useState('home');
  const [admin, setAdmin] = useState(false);
  const [selectedPlaza, setSelectedPlaza] = useState('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({
    plazaId: '',
    category: 'Iluminação',
    description: '',
    photo: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      if (!session?.user?.id) {
        setAdmin(false);
        return;
      }

      setAdmin(false);

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!active) return;

      if (error) {
        console.error('Erro ao verificar administrador:', error);
        setAdmin(false);
        return;
      }

      setAdmin(data?.role === 'admin');
    };

    checkAdmin();

    return () => {
      active = false;
    };
  }, [session]);



  useEffect(() => {
    let active = true;

    const loadReports = async () => {
      if (!session?.user?.id) {
        setReports([]);
        return;
      }

      let query = supabase
        .from('occurrences')
        .select('id, protocol, user_id, plaza_id, category, description, photo_url, latitude, longitude, status, created_at');

      if (!admin) {
        query = query.eq('user_id', session.user.id);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (!active) return;

      if (error) {
        console.error('Erro ao carregar ocorrências:', error);
        setNotice('Não foi possível carregar as ocorrências.');
        return;
      }

      const formattedReports = await Promise.all(
        (data || []).map(async item => {
          let photo = '';

          if (item.photo_url) {
            const { data: signedData, error: signedError } =
              await supabase.storage
                .from('occurrence-photos')
                .createSignedUrl(item.photo_url, 60 * 60);

            if (signedError) {
              console.error('Erro ao gerar link da fotografia:', signedError);
            } else {
              photo = signedData.signedUrl;
            }
          }

          return {
            id: item.protocol,
            plazaId: item.plaza_id,
            category: item.category,
            description: item.description,
            latitude: item.latitude,
            longitude: item.longitude,
            status: {
              received: 'Recebido',
              analyzing: 'Em análise',
              in_progress: 'Em atendimento',
              resolved: 'Resolvido'
            }[item.status] || item.status,
            date: new Date(item.created_at).toLocaleString('pt-BR', {
              dateStyle: 'short',
              timeStyle: 'short'
            }),
            citizen: 'Cidadão',
            photo
          };
        })
      );

      if (active) {
        setReports(formattedReports);
      }
    };

    loadReports();

    return () => {
      active = false;
    };
  }, [session, admin]);




  const saveReports = (next) => {
    setReports(next);
    localStorage.setItem('praca-segura-reports', JSON.stringify(next));
  };

  const filtered = useMemo(
    () => reports.filter(r =>
      (selectedPlaza === 'all' || r.plazaId === selectedPlaza) &&
      `${r.id} ${r.category} ${r.description} ${plazas.find(p => p.id === r.plazaId)?.name || ''
        }`.toLowerCase().includes(search.toLowerCase())
    ),
    [reports, selectedPlaza, search, plazas]
  );

  const plazaName = id =>
    plazas.find(p => p.id === id)?.name || 'Praça não identificada';

  const go = p => {
    setPage(p);
    setMenuOpen(false);
    setNotice('');
  };
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setNotice('Não foi possível sair da conta: ' + error.message);
      return;
    }

    setAdmin(false);
    setPage('home');
    setMenuOpen(false);
  };



  const createReport = async (e) => {
    e.preventDefault();

    if (!form.plazaId) {
      setNotice('Selecione uma praça antes de continuar.');
      return;
    }

    if (form.description.trim().length < 8) {
      setNotice('Descreva o problema com pelo menos 8 caracteres.');
      return;
    }

    if (!session?.user?.id) {
      setNotice('Sua sessão expirou. Entre novamente.');
      return;
    }

    const protocol = `PS-${new Date().getFullYear()}-${Date.now()}`;
    let photoPath = '';

    if (photoFile) {
      const extensions = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      const fileExt = extensions[photoFile.type];

      if (!fileExt) {
        setNotice('Utilize uma imagem JPG, PNG ou WEBP.');
        return;
      }

      photoPath = `${session.user.id}/${protocol}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('occurrence-photos')
        .upload(photoPath, photoFile, {
          contentType: photoFile.type,
          upsert: false
        });

      if (uploadError) {
        console.error('Erro ao enviar fotografia:', uploadError);
        setNotice('Não foi possível enviar a fotografia: ' + uploadError.message);
        return;
      }
    }

    const { data, error } = await supabase
      .from('occurrences')
      .insert({
        protocol,
        user_id: session.user.id,
        plaza_id: form.plazaId,
        category: form.category,
        description: form.description.trim(),
        photo_url: photoPath || null,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
        status: 'received'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar ocorrência:', error);

      if (photoPath) {
        await supabase.storage
          .from('occurrence-photos')
          .remove([photoPath]);
      }

      setNotice('Não foi possível enviar a ocorrência: ' + error.message);
      return;
    }

    let photoUrl = '';

    if (photoPath) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('occurrence-photos')
        .createSignedUrl(photoPath, 60 * 60);

      if (!signedError) {
        photoUrl = signedData.signedUrl;
      }
    }

    const newReport = {
      id: data.protocol,
      plazaId: data.plaza_id,
      latitude: data.latitude,
      longitude: data.longitude,
      category: data.category,
      description: data.description,
      status: 'Recebido',
      date: new Date(data.created_at).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }),
      citizen: 'Cidadão',
      photo: photoUrl
    };

    setReports(current => [newReport, ...current]);

    setForm({
      plazaId: plazas[0]?.id || '',
      category: 'Iluminação',
      description: '',
      photo: ''
    });

    setPhotoFile(null);
    setPhotoPreview('');

    setLocation(null);
    setLocationError('');
    setLocationLoading(false);

    setShowForm(false);
    setNotice(`Ocorrência enviada! Seu protocolo é ${protocol}.`);
    setPage('reports');
  };




  const updateStatus = async (id, status) => {
    const statusMap = {
      'Recebido': 'received',
      'Em análise': 'analyzing',
      'Em atendimento': 'in_progress',
      'Resolvido': 'resolved'
    };

    const dbStatus = statusMap[status];

    if (!dbStatus) {
      setNotice('Status inválido.');
      return;
    }

    const { error } = await supabase
      .from('occurrences')
      .update({
        status: dbStatus,
        updated_at: new Date().toISOString()
      })
      .eq('protocol', id);

    if (error) {
      console.error('Erro ao atualizar status:', error);
      setNotice('Não foi possível atualizar o status: ' + error.message);
      return;
    }

    setReports(current =>
      current.map(report =>
        report.id === id
          ? { ...report, status }
          : report
      )
    );

    setNotice('Status da ocorrência atualizado com sucesso!');
  };



  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setNotice('Selecione um arquivo de imagem válido.');
      e.target.value = '';
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setNotice('A foto original deve ter no máximo 15 MB.');
      e.target.value = '';
      return;
    }

    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();

      image.src = imageUrl;
      await image.decode();

      const maxDimension = 1600;
      const scale = Math.min(
        1,
        maxDimension / Math.max(image.width, image.height)
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(imageUrl);

      const compressImage = quality =>
        new Promise((resolve, reject) => {
          canvas.toBlob(
            blob => {
              if (blob) resolve(blob);
              else reject(new Error('Falha ao comprimir a imagem.'));
            },
            'image/jpeg',
            quality
          );
        });

      let compressedBlob = await compressImage(0.82);

      if (compressedBlob.size > 5 * 1024 * 1024) {
        compressedBlob = await compressImage(0.65);
      }

      if (compressedBlob.size > 5 * 1024 * 1024) {
        setNotice('Não foi possível reduzir a foto para menos de 5 MB.');
        e.target.value = '';
        return;
      }

      const compressedFile = new File(
        [compressedBlob],
        `foto-${Date.now()}.jpg`,
        { type: 'image/jpeg' }
      );

      setPhotoFile(compressedFile);
      setPhotoPreview(URL.createObjectURL(compressedFile));
      setNotice('');
    } catch (error) {
      console.error('Erro ao processar fotografia:', error);
      setNotice('Não foi possível processar essa imagem. Tente outra foto.');
      e.target.value = '';
    }
  };


  const getLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Seu navegador não oferece suporte à localização.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });

        setLocationLoading(false);
      },
      error => {
        setLocationLoading(false);

        if (error.code === 1) {
          setLocationError('Permissão de localização negada.');
        } else if (error.code === 2) {
          setLocationError('Não foi possível identificar sua localização.');
        } else {
          setLocationError('Tempo esgotado ao buscar localização.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };
  const closeReportForm = () => {
    setShowForm(false);
    setLocation(null);
    setLocationError('');
    setLocationLoading(false);
  };

  const formPlaza = plazas.find(
    p => String(p.id) === String(form.plazaId)
  );

  const locationDistance = (() => {
    if (
      !location ||
      !formPlaza?.latitude ||
      !formPlaza?.longitude
    ) {
      return null;
    }

    const toRadians = degrees => degrees * Math.PI / 180;

    const lat1 = toRadians(location.latitude);
    const lat2 = toRadians(Number(formPlaza.latitude));
    const deltaLat = toRadians(Number(formPlaza.latitude) - location.latitude);
    const deltaLon = toRadians(Number(formPlaza.longitude) - location.longitude);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) ** 2;

    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  })();

  const stats = {
    total: reports.length,
    open: reports.filter(r => r.status !== 'Resolvido').length,
    done: reports.filter(r => r.status === 'Resolvido').length
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [resetMode, setResetMode] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const [authMessage, setAuthMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage('');

    if (authMode === 'signup' && !fullName.trim()) {
      setAuthMessage('Informe seu nome completo.');
      return;
    }

    const { error } = authMode === 'login'
      ? await supabase.auth.signInWithPassword({
        email,
        password
      })
      : await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

    if (error) {
      setAuthMessage(error.message);
    } else if (authMode === 'signup') {
      setAuthMessage(
        'Cadastro realizado! Verifique seu e-mail, se necessário.'
      );
    }
  };
  const handleForgotPassword = async () => {
    setAuthMessage('');

    if (!email.trim()) {
      setAuthMessage('Digite seu e-mail para recuperar a senha.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      setAuthMessage('Não foi possível enviar o e-mail: ' + error.message);
    } else {
      setAuthMessage('Enviamos um link de recuperação para seu e-mail. Verifique sua caixa de entrada.');
    }
  };
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setAuthMessage('');

    if (password.length < 6) {
      setAuthMessage('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthMessage('As senhas não coincidem.');
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setAuthMessage('Erro ao alterar a senha: ' + error.message);
      return;
    }

    setAuthMessage('Senha alterada com sucesso! Faça login com sua nova senha.');
    setResetPassword(false);
    setPassword('');
    setConfirmPassword('');

    await supabase.auth.signOut();
  };

  if (authLoading) {
    return <div>Carregando...</div>;
  }
  if (resetPassword) {
    return (
      <div className="auth-screen">
        <div className="auth-content">
          <div className="auth-brand">
            <span className="auth-brand-icon">
              <TreePine size={27} />
            </span>
            <div>
              <strong>PRAÇA SEGURA</strong>
              <span>RECIFE · CUIDADO COLETIVO</span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-tag">RECUPERAÇÃO DE ACESSO</span>
              <h1>Crie sua <em>nova senha.</em></h1>
              <p>Digite e confirme sua nova senha para recuperar o acesso.</p>
            </div>

            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <label>
                Nova senha
                <input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>

              <label>
                Confirmar nova senha
                <input
                  type="password"
                  placeholder="Digite novamente a senha"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>

              {authMessage && (
                <div className="auth-message">
                  {authMessage}
                </div>
              )}

              <button className="auth-submit" type="submit">
                Alterar minha senha
                <ChevronRight size={19} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }


  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-grid"></div>
        <div className="auth-glow auth-glow-one"></div>
        <div className="auth-glow auth-glow-two"></div>

        <div className="auth-decoration auth-decoration-one"></div>
        <div className="auth-decoration auth-decoration-two"></div>
        <div className="auth-decoration auth-decoration-three"></div>

        <div className="auth-content">
          <div className="auth-brand">
            <span className="auth-brand-icon">
              <TreePine size={27} />
            </span>
            <div>
              <strong>PRAÇA SEGURA</strong>
              <span>RECIFE · CUIDADO COLETIVO</span>
            </div>
          </div>

          <div className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-icon">
                <ShieldCheck size={22} />
              </span>
              <span className="auth-tag">ACESSO À PLATAFORMA</span>
              <h1>
                {authMode === 'login'
                  ? <>Bem-vindo <em>de volta.</em></>
                  : <>Faça seu <em>cadastro.</em></>}
              </h1>
              <p>
                {authMode === 'login'
                  ? 'Entre para acompanhar e registrar ocorrências nas praças.'
                  : 'Crie sua conta e participe do cuidado com os espaços públicos.'}
              </p>
            </div>

            <form className="auth-form" onSubmit={handleAuth}>
              {authMode === 'signup' && (
                <label>
                  Nome completo
                  <input
                    type="text"
                    placeholder="Digite seu nome"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </label>
              )}

              <label>
                E-mail
                <input
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </label>

              <label>
                Senha
                <input
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </label>
              {authMode === 'login' && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={handleForgotPassword}
                >
                  Esqueci minha senha
                </button>
              )}

              {authMessage && (
                <div className="auth-message">
                  {authMessage}
                </div>
              )}

              <button className="auth-submit" type="submit">
                {authMode === 'login' ? 'Entrar na plataforma' : 'Criar minha conta'}
                <ChevronRight size={19} />
              </button>
            </form>

            <div className="auth-divider">
              <span>ACESSO SEGURO</span>
            </div>

            <div className="auth-security">
              <ShieldCheck size={17} />
              <span>Seus dados protegidos pela autenticação Supabase</span>
            </div>

            <div className="auth-switch">
              {authMode === 'login'
                ? 'Ainda não possui uma conta?'
                : 'Já possui uma conta?'}

              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                  setAuthMessage('');
                }}
              >
                {authMode === 'login' ? 'Cadastre-se' : 'Fazer login'}
              </button>
            </div>
          </div>

          <div className="auth-footer">
            <span>© 2026 Praça Segura</span>
            <span>PROTÓTIPO ACADÊMICO</span>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go('home')}>
          <span className="brand-mark">
            <TreePine size={23} />
          </span>
          <span>
            <b>PRAÇA SEGURA</b>
            <small>RECIFE · CUIDADO COLETIVO</small>
          </span>
        </button>

        <nav className="desktop-nav">
          <button className={page === 'home' ? 'active' : ''} onClick={() => go('home')}>Início</button>
          <button className={page === 'plazas' ? 'active' : ''} onClick={() => go('plazas')}>Praças</button>
          <button className={page === 'reports' ? 'active' : ''} onClick={() => go('reports')}>Ocorrências</button>
          <button className={page === 'about' ? 'active' : ''} onClick={() => go('about')}>Sobre</button>
        </nav>

        <div className="top-actions">
          {admin && (
            <button
              className="admin-toggle"
              onClick={() => go(page === 'admin' ? 'home' : 'admin')}
            >
              {page === 'admin' ? (
                <LayoutDashboard size={16} />
              ) : (
                <ShieldCheck size={16} />
              )}
              {page === 'admin' ? 'Painel Público' : 'Painel Administrativo'}
            </button>
          )}

          <button className="admin-toggle" onClick={handleLogout}>
            <LogOut size={16} />
            Sair
          </button>

          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className="mobile-nav">
          <button onClick={() => go('home')}>Início</button>
          <button onClick={() => go('plazas')}>Praças</button>
          <button onClick={() => go('reports')}>Ocorrências</button>
          <button onClick={() => go('about')}>Sobre</button>
          {admin && (
            <button onClick={() => go('admin')}>
              Área administrativa
            </button>
          )}
        </div>
      )}

      <main>
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span /> PARTICIPAÇÃO CIDADÃ · RECIFE
                </div>

                <h1>Sua praça,<br /><em>nosso cuidado.</em></h1>

                <p>
                  Encontrou um problema em uma praça? Informe à comunidade e ajude a cuidar dos espaços públicos do Recife.
                </p>

                <div className="hero-buttons">
                  <button className="primary-btn" onClick={() => setShowForm(true)}>
                    <Plus size={18} /> Registrar um problema
                  </button>

                  <button className="secondary-btn" onClick={() => go('plazas')}>
                    Conhecer as praças <ChevronRight size={17} />
                  </button>
                </div>

                <div className="hero-note">
                  <ShieldCheck size={17} /> Simples, acessível e colaborativo.
                </div>
              </div>

              <div className="hero-art">
                <div className="art-orbit orbit-one" />
                <div className="art-orbit orbit-two" />
                <div className="park-card">
                  <div className="park-sun" />
                  <div className="park-tree tree-a" />
                  <div className="park-tree tree-b" />
                  <div className="park-path" />
                  <div className="park-bench"><i /><i /><i /></div>
                  <div className="park-label">
                    <span className="live-dot" /> ESPAÇOS PÚBLICOS
                  </div>
                </div>
                <div className="floating-chip chip-top">
                  <MapPin size={16} /> Praças do Recife
                </div>
                <div className="floating-chip chip-bottom">
                  <Users size={16} /> Sua participação importa
                </div>
              </div>
            </section>

            <section className="stats-row">
              <div>
                <b>{plazasLoading ? '…' : plazas.length}</b>
                <span>espaços cadastrados</span>
              </div>
              <div><b>{stats.total}</b><span>ocorrências registradas</span></div>
              <div><b>{stats.done}</b><span>ocorrências resolvidas</span></div>
            </section>

            <section className="section-block">
              <div className="section-heading">
                <div>
                  <span className="eyebrow dark">COMO PARTICIPAR</span>
                  <h2>Cuidar da praça é <em>mais simples</em> do que parece.</h2>
                </div>
                <p>Um canal direto para comunicar necessidades e acompanhar os registros.</p>
              </div>

              <div className="steps-grid">
                <article className="step-card">
                  <span className="step-number">01</span>
                  <MapPin />
                  <h3>Escolha a praça</h3>
                  <p>Encontre o espaço público onde identificou o problema.</p>
                </article>

                <article className="step-card">
                  <span className="step-number">02</span>
                  <ClipboardList />
                  <h3>Registre a situação</h3>
                  <p>Selecione a categoria, descreva o que aconteceu e, se possível, anexe uma foto.</p>
                </article>

                <article className="step-card">
                  <span className="step-number">03</span>
                  <CheckCircle2 />
                  <h3>Acompanhe</h3>
                  <p>Consulte o protocolo e veja a atualização do andamento.</p>
                </article>
              </div>
            </section>

            <section className="cta-band">
              <div>
                <span className="eyebrow">CUIDADO COLETIVO</span>
                <h2>Uma cidade melhor começa<br />nos espaços que compartilhamos.</h2>
              </div>
              <button className="light-btn" onClick={() => setShowForm(true)}>
                Fazer um registro <ChevronRight size={17} />
              </button>
            </section>
          </>
        )}

        {page === 'plazas' && (
          <section className="page-section">
            <div className="page-title">
              <span className="eyebrow dark">EXPLORE OS ESPAÇOS</span>
              <h1>Praças do <em>Recife</em></h1>
              <p>Selecione uma praça para conhecer o espaço ou consultar os registros demonstrativos.</p>
            </div>

            <div className="plaza-grid">
              {plazasLoading ? (
                <p>Carregando espaços cadastrados...</p>
              ) : plazasError ? (
                <p>{plazasError}</p>
              ) : plazas.length === 0 ? (
                <p>Nenhum espaço cadastrado foi encontrado.</p>
              ) : (
                plazas.map((p, i) => (
                  <article className="plaza-card" key={p.id}>
                    <div className={`plaza-visual visual-${i % 4}`}>
                      <TreePine size={45} />
                      <span>{p.bairro || p.tipo || 'Recife'}</span>
                    </div>

                    <div className="plaza-content">
                      <h3>{p.name}</h3>
                      <p>{p.description || p.address || 'Espaço público cadastrado no Recife.'}</p>

                      <div className="plaza-bottom">
                        <span>{reports.filter(r => r.plazaId === p.id).length} registros</span>
                        <button onClick={() => { setSelectedPlaza(p.id); go('reports'); }}>
                          Ver ocorrências <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <p className="demo-note">
              Cadastro de espaços públicos carregado do banco de dados do Praça Segura. A validação e eventual integração com canais oficiais dependem de parceria institucional.
            </p>
          </section>
        )}

        {page === 'reports' && (
          <section className="page-section">
            <div className="page-title row-title">
              <div>
                <span className="eyebrow dark">TRANSPARÊNCIA E ACOMPANHAMENTO</span>
                <h1>Ocorrências <em>registradas</em></h1>
                <p>Consulte os registros de problemas nas praças.</p>
              </div>
              <button className="primary-btn" onClick={() => setShowForm(true)}>
                <Plus size={17} /> Nova ocorrência
              </button>
            </div>

            <div className="filter-bar">
              <div className="search-box">
                <Search size={17} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ocorrência..." />
              </div>

              <select value={selectedPlaza} onChange={e => setSelectedPlaza(e.target.value)}>
                <option value="all">Todas as praças</option>
                {plazas.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
              </select>

              <button className="text-btn" onClick={() => { setSelectedPlaza('all'); setSearch(''); }}>
                Limpar filtros
              </button>
            </div>

            <div className="report-list">
              {filtered.length === 0 ? (
                <div className="empty-state">
                  <ClipboardList size={35} />
                  <h3>Nenhuma ocorrência encontrada</h3>
                  <p>Experimente alterar os filtros ou registre um novo problema.</p>
                </div>
              ) : (
                filtered.map(r => (
                  <ReportCard
                    key={r.id}
                    report={r}
                    plazaName={plazaName}
                    admin={admin}
                    updateStatus={updateStatus}
                  />
                ))
              )}
            </div>
          </section>
        )}

        {page === 'admin' && admin && (
          <section className="page-section">
            <div className="page-title">
              <span className="eyebrow dark">AMBIENTE DEMONSTRATIVO</span>
              <h1>Painel <em>administrativo</em></h1>
              <p>Visão de acompanhamento das ocorrências enviadas pelos cidadãos.</p>
            </div>


            <div className="admin-banner">
              <ShieldCheck />
              <div>
                <b>Painel conectado ao Supabase</b>
                <span>
                  Área administrativa protegida por autenticação.
                  As ocorrências e os dados são armazenados no banco de dados do Praça Segura.
                  Ainda não existe integração oficial com a Prefeitura do Recife.
                </span>
              </div>
              <button onClick={() => { setAdmin(false); go('home'); }}>
                <LogOut size={15} /> Sair
              </button>
            </div>

            <div className="admin-metrics">
              <Metric icon={<ClipboardList />} label="Total de registros" value={stats.total} />
              <Metric icon={<Clock3 />} label="Em aberto" value={stats.open} />
              <Metric icon={<CheckCircle2 />} label="Resolvidos" value={stats.done} />
            </div>

            <div className="admin-table-wrap">
              <div className="table-heading">
                <h3>Gerenciar ocorrências</h3>
                <span>Atualize o status de cada registro</span>
              </div>

              <div className="admin-table">
                {reports.map(r => (
                  <div className="admin-row" key={r.id}>
                    <div>

                      <b>{r.id}</b>
                      <span>{plazaName(r.plazaId)} · {r.category}</span>
                      <small>Registrada em: {r.date}</small>

                      {r.latitude != null && r.longitude != null ? (
                        <small>
                          GPS: {Number(r.latitude).toFixed(6)}, {Number(r.longitude).toFixed(6)}
                        </small>
                      ) : (
                        <small>Localização GPS não informada</small>
                      )}

                    </div>
                    <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}>
                      <option>Recebido</option>
                      <option>Em análise</option>
                      <option>Em atendimento</option>
                      <option>Resolvido</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {page === 'about' && (
          <section className="page-section about-page">
            <span className="eyebrow dark">SOBRE O PROJETO</span>
            <h1>Tecnologia simples<br /><em>para cuidar melhor.</em></h1>
            <p className="about-lead">
              O Praça Segura é uma proposta de plataforma digital para fortalecer a participação cidadã na conservação dos espaços públicos do Recife.
            </p>

            <div className="about-cards">
              <article>
                <Users />
                <h3>Participação cidadã</h3>
                <p>Moradores e visitantes podem comunicar situações que precisam de atenção.</p>
              </article>
              <article>
                <Leaf />
                <h3>Cuidado coletivo</h3>
                <p>Incentiva a colaboração e o zelo pelos espaços de convivência.</p>
              </article>
              <article>
                <ShieldCheck />
                <h3>Transparência</h3>
                <p>Permite acompanhar o status dos registros em uma interface simples.</p>
              </article>
            </div>

            <div className="disclaimer">
              <Info size={19} />
              <p>
                <b>Importante:</b> este mini app é um protótipo acadêmico. O envio de ocorrências ainda não chega à Prefeitura do Recife. Uma integração oficial dependerá de parceria institucional, validação dos canais e implantação de infraestrutura adequada.
              </p>
            </div>
          </section>
        )}
      </main>

      <footer>
        <div className="footer-brand">
          <span className="brand-mark"><TreePine size={20} /></span>
          <b>PRAÇA SEGURA</b>
        </div>
        <span>Uma proposta de participação cidadã · Recife</span>
        <span>Protótipo acadêmico · 2026</span>
      </footer>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) closeReportForm(); }}>
          <form className="report-modal" onSubmit={createReport}>
            <div className="modal-head">
              <div>
                <span className="eyebrow dark">PARTICIPE</span>
                <h2>Registrar um problema</h2>
                <p>Conte o que precisa de atenção na praça.</p>
              </div>
              <button type="button" className="close-btn" onClick={closeReportForm}>
                <X />
              </button>
            </div>

            <label>
              Qual praça?
              <select
                value={form.plazaId}
                onChange={e => setForm({ ...form, plazaId: e.target.value })}
                required
                disabled={plazasLoading || plazas.length === 0}
              >
                {plazas.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label>
              Tipo de problema
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {categories.map(c => <option key={c.value}>{c.value}</option>)}
              </select>
            </label>

            <label>
              Descreva o que aconteceu
              <textarea
                rows="4"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: poste apagado próximo aos bancos..."
                required
              />
            </label>

            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={getLocation}
                disabled={locationLoading}
              >
                <MapPin size={17} />
                {locationLoading
                  ? 'Obtendo localização...'
                  : location
                    ? 'Localização capturada'
                    : 'Usar minha localização'}
              </button>

              {location && (
                <p>
                  <CheckCircle2 size={15} />
                  Localização GPS obtida com sucesso.
                </p>
              )}

              {locationError && (
                <p>{locationError}</p>
              )}
            </div>

            {locationDistance !== null && locationDistance > 500 && (
              <div className="inline-notice">
                <AlertTriangle size={17} />
                Você está a mais de 500 metros da praça selecionada.
                Confira se escolheu a praça correta.
                Distância aproximada: {(locationDistance / 1000).toFixed(2)} km.
              </div>
            )}


            <label className="upload-area">
              <Camera size={21} />
              <span>
                <b>{photoPreview ? 'Foto anexada' : 'Adicionar fotografia (opcional)'}</b>
                <small>Fotos até 15 MB · compressão automática</small>
              </span>
              <input type="file" accept="image/*" onChange={uploadPhoto} />
            </label>

            {photoPreview && (
              <img className="photo-preview" src={photoPreview} alt="Prévia da fotografia anexada" />
            )}

            <div className="privacy-hint">
              <Info size={16} /> Não inclua dados pessoais de terceiros nem fotografe pessoas sem consentimento.
            </div>

            {notice && <div className="inline-notice">{notice}</div>}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={closeReportForm}>
                Cancelar
              </button>
              <button className="primary-btn" type="submit">
                Enviar ocorrência <ChevronRight size={17} />
              </button>
            </div>
          </form>
        </div>
      )}

      {notice && !showForm && (
        <div className="toast" onClick={() => setNotice('')}>
          <CheckCircle2 size={18} />
          {notice}
          <button aria-label="Fechar"><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="metric-card">
      <span>{icon}</span>
      <div>
        <b>{value}</b>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ReportCard({ report, plazaName, admin, updateStatus }) {
  const [expanded, setExpanded] = useState(false);
  const cls = report.status.toLowerCase().replaceAll(' ', '-');

  return (
    <article className="report-card">
      <div className="report-icon"><ClipboardList /></div>
      <div className="report-main">
        <div className="report-top">
          <b>{report.id}</b>
          <span className={`status status-${cls}`}>{report.status}</span>
        </div>
        <h3>{report.category}</h3>
        <p>{report.description}</p>
        <div className="report-meta">
          <span><MapPin size={14} />{plazaName(report.plazaId)}</span>
          <span>{report.date}</span>
        </div>

        {report.photo && (
          <button className="photo-link" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Ocultar fotografia' : 'Ver fotografia'}
          </button>
        )}

        {expanded && report.photo && (
          <img className="report-photo" src={report.photo} alt="Fotografia da ocorrência" />
        )}

        {admin && (
          <select
            className="inline-status"
            value={report.status}
            onChange={e => updateStatus(report.id, e.target.value)}
          >
            <option>Recebido</option>
            <option>Em análise</option>
            <option>Em atendimento</option>
            <option>Resolvido</option>
          </select>
        )}
      </div>
    </article>
  );
}

createRoot(document.getElementById('root')).render(<App />);