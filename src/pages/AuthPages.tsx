import {
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import React, { useState } from 'react';
import { NIGER_CITIES } from '../constants';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { ensureUserProfile } from '../lib/firestoreService';

function formatFirebaseAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('auth/operation-not-allowed')) {
    return 'Le fournisseur Email/Mot de passe n’est pas encore activé dans votre console Firebase (Authentication > Sign-in method > Adresse e-mail/Mot de passe). Vous pouvez utiliser la connexion Google en attendant.';
  }
  if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
    return 'Email ou mot de passe incorrect.';
  }
  if (msg.includes('auth/email-already-in-use')) {
    return 'Un compte existe déjà avec cette adresse email.';
  }
  if (msg.includes('auth/weak-password')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (msg.includes('auth/invalid-email')) {
    return 'Adresse email invalide.';
  }
  if (msg.includes('auth/popup-closed-by-user')) {
    return 'Fenêtre de connexion Google fermée avant la fin.';
  }
  if (msg.includes('auth/too-many-requests')) {
    return 'Trop de tentatives. Veuillez réessayer dans quelques instants.';
  }
  return msg;
}

export function LoginPage() {
  const { navigate, refreshAuth, showToast } = useApp();
  const { signInWithEmailAndPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectAfterLogin = (roles: string[]) => {
    if (roles.includes('admin')) {
      navigate('/admin');
    } else if (roles.includes('vendor')) {
      navigate('/espace-vendeur');
    } else {
      navigate('/espace-client');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(email.trim(), password);
      const profile = await ensureUserProfile({
        uid: cred.user.uid,
        fullName: cred.user.displayName || 'Utilisateur TSM',
        email: cred.user.email || email.trim(),
        photoURL: cred.user.photoURL || '',
      });
      await refreshAuth();
      showToast(`Bienvenue, ${profile.fullName} !`, 'success');
      redirectAfterLogin(profile.roles);
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      const profile = await ensureUserProfile({
        uid: cred.user.uid,
        fullName: cred.user.displayName || 'Utilisateur Google',
        email: cred.user.email || `${cred.user.uid}@tsm.local`,
        photoURL: cred.user.photoURL || '',
      });
      await refreshAuth();
      showToast(`Bienvenue, ${profile.fullName} !`, 'success');
      redirectAfterLogin(profile.roles);
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">Connexion</h1>
        <p className="text-sm text-slate-600 mb-6">
          Accédez à votre espace client, vendeur ou administrateur.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adresse email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@domaine.ne"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Mot de passe</label>
              <button
                type="button"
                onClick={() => navigate('/mot-de-passe-oublie')}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
              >
                Mot de passe oublié ?
              </button>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading ? 'Connexion en cours...' : 'Se connecter'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-xs text-slate-400">ou</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full py-2.5 px-4 rounded-lg border border-slate-300 hover:border-[#0B1528] bg-white text-[#0B1528] text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <span>Continuer avec Google</span>
        </button>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
          Pas encore de compte ?{' '}
          <button
            type="button"
            onClick={() => navigate('/inscription')}
            className="font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
          >
            Créer un compte
          </button>
        </div>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { navigate, refreshAuth, showToast } = useApp();
  const { createUserWithEmailAndPassword, signInWithGoogle } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Niamey');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState<'client' | 'vendor' | 'both'>('client');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const chosenRoles: Array<'client' | 'vendor'> =
    accountType === 'vendor'
      ? ['vendor']
      : accountType === 'both'
        ? ['client', 'vendor']
        : ['client'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 2) {
      setError('Veuillez renseigner votre nom complet.');
      return;
    }
    if (phone.trim().length < 8) {
      setError('Numéro de téléphone valide requis.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() }).catch(() => {});
      await sendEmailVerification(cred.user).catch(() => {});
      await ensureUserProfile({
        uid: cred.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city,
        roles: chosenRoles,
      });
      await refreshAuth();
      showToast('Compte créé avec succès !', 'success');
      if (accountType === 'vendor' || accountType === 'both') {
        navigate('/creer-boutique');
      } else {
        navigate('/espace-client');
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    setLoading(true);
    try {
      const cred = await signInWithGoogle();
      await ensureUserProfile({
        uid: cred.user.uid,
        fullName: cred.user.displayName || fullName.trim() || 'Utilisateur Google',
        email: cred.user.email || `${cred.user.uid}@tsm.local`,
        phone: phone.trim(),
        city,
        photoURL: cred.user.photoURL || '',
        roles: chosenRoles,
      });
      await refreshAuth();
      showToast('Compte Google associé avec succès !', 'success');
      if (accountType === 'vendor' || accountType === 'both') {
        navigate('/creer-boutique');
      } else {
        navigate('/espace-client');
      }
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">Inscription</h1>
        <p className="text-sm text-slate-600 mb-6">
          Rejoignez TECH STYLE MARKET en tant que client, vendeur ou les deux simultanément.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Type de compte</label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'client', label: 'Client' },
                  { id: 'vendor', label: 'Vendeur' },
                  { id: 'both', label: 'Client & Vendeur' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAccountType(opt.id)}
                  className={`py-2.5 px-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    accountType === opt.id
                      ? 'bg-[#0B1528] text-white border-[#0B1528]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom complet</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex. Moussa Boubacar"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemple.ne"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+227 90 00 00 00"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-orange-600"
              >
                {NIGER_CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mot de passe (min. 6 car.)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {loading ? 'Création du compte...' : 'Créer mon compte'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px bg-slate-200 flex-1" />
          <span className="text-xs text-slate-400">ou</span>
          <div className="h-px bg-slate-200 flex-1" />
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignUp}
          className="w-full py-2.5 px-4 rounded-lg border border-slate-300 hover:border-[#0B1528] bg-white text-[#0B1528] text-sm font-semibold transition-colors cursor-pointer"
        >
          S’inscrire avec Google
        </button>

        <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-600">
          Déjà inscrit ?{' '}
          <button
            type="button"
            onClick={() => navigate('/connexion')}
            className="font-semibold text-[#0B1528] hover:text-orange-600 cursor-pointer"
          >
            Se connecter
          </button>
        </div>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const { navigate, showToast } = useApp();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      showToast('Email de réinitialisation envoyé.', 'success');
    } catch (err) {
      setError(formatFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">
          Récupération de mot de passe
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Saisissez votre adresse email pour recevoir un lien sécurisé de réinitialisation via
          Firebase Authentication.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {sent ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              Un email de réinitialisation vient d’être envoyé à <strong>{email}</strong>. Vérifiez
              votre boîte de réception et vos spams.
            </div>
            <button
              type="button"
              onClick={() => navigate('/connexion')}
              className="w-full py-3 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
            >
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@domaine.ne"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
            >
              {loading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
