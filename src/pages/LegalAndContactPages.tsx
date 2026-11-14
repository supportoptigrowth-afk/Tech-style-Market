import { Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import React, { useState } from 'react';
import { OFFICIAL_EMAIL, OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_RAW } from '../constants';
import { useApp } from '../context/AppContext';

export function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-6">
        Conditions générales d’utilisation
      </h1>
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            1. Objet de la plateforme
          </h2>
          <p>
            TECH STYLE MARKET est une marketplace multi-vendeurs opérant au Niger et à
            l’international, mettant en relation des acheteurs et des commerçants indépendants.
            Toutes les transactions sur la plateforme sont exprimées en Francs CFA (FCFA / XOF).
          </p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            2. Modes d’achat et paiement
          </h2>
          <p>
            Les clients peuvent commander directement sur le site avec paiement à la livraison ou
            initier une commande directe via WhatsApp auprès du vendeur concerné (ou via le support
            officiel {OFFICIAL_WHATSAPP_DISPLAY} lorsque le vendeur n’a pas renseigné de numéro).
          </p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            3. Engagements des vendeurs
          </h2>
          <p>
            Chaque vendeur est responsable de l’exactitude des descriptions, prix en FCFA, stocks
            disponibles et de la conformité légale des articles publiés. L’administration se réserve
            le droit de suspendre toute boutique ou annonce non conforme.
          </p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            4. Live Shopping et messagerie
          </h2>
          <p>
            Les diffusions en direct et échanges dans la messagerie doivent rester professionnels,
            respectueux et conformes aux lois en vigueur en République du Niger.
          </p>
        </section>
      </div>
    </div>
  );
}

export function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-6">
        Politique de confidentialité
      </h1>
      <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            1. Données collectées
          </h2>
          <p>
            Nous collectons uniquement les données nécessaires au fonctionnement des comptes, à la
            préparation des commandes et à la mise en relation client-vendeur : nom complet, adresse
            email, numéro de téléphone, ville et adresse de livraison.
          </p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            2. Sécurité et isolation des accès
          </h2>
          <p>
            Les mots de passe sont chiffrés côté serveur, les sessions sont protégées par jetons
            signés et chaque vendeur n’accède qu’aux commandes et statistiques de sa propre
            boutique.
          </p>
        </section>
        <section>
          <h2 className="font-display font-bold text-lg text-[#0B1528] mb-2">
            3. Vos droits
          </h2>
          <p>
            Vous pouvez modifier vos informations personnelles à tout moment depuis votre espace
            client ou demander la suppression de vos données via {OFFICIAL_EMAIL}.
          </p>
        </section>
      </div>
    </div>
  );
}

export function ContactPage() {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const waText = `Contact TECH STYLE MARKET\nNom : ${name}\nEmail : ${email}\nMessage : ${message}`;
  const waHref = `https://wa.me/${OFFICIAL_WHATSAPP_RAW}?text=${encodeURIComponent(waText)}`;
  const canSend = Boolean(name.trim() && email.trim() && message.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    showToast('Lien WhatsApp prêt ci-dessous pour envoyer votre message.', 'success');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">
        Contacter TECH STYLE MARKET
      </h1>
      <p className="text-sm text-slate-600 mb-8">
        Notre équipe basée à Niamey accompagne les acheteurs et commerçants 7j/7.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-5 bg-[#0B1528] text-white rounded-xl p-6 space-y-5">
          <h2 className="font-display font-bold text-lg">Coordonnées officielles</h2>
          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-semibold">Téléphone &amp; WhatsApp officiel</p>
                <p className="font-mono">{OFFICIAL_WHATSAPP_DISPLAY}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-semibold">Email support</p>
                <p>{OFFICIAL_EMAIL}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-semibold">Siège opérationnel</p>
                <p>Niamey, République du Niger</p>
              </div>
            </div>
          </div>

          <a
            href={`https://wa.me/${OFFICIAL_WHATSAPP_RAW}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Écrire directement sur WhatsApp</span>
          </a>
        </div>

        <form
          onSubmit={handleSubmit}
          className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display font-bold text-lg text-[#0B1528]">Envoyer un message</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nom complet</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          {canSend ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => showToast('Ouverture de WhatsApp vers le support officiel.', 'success')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contacter via WhatsApp</span>
            </a>
          ) : (
            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold cursor-pointer"
            >
              Contacter via WhatsApp
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
