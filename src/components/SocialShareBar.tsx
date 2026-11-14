import { Check, Link2, MessageCircle, Share2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context/AppContext';

interface SocialShareBarProps {
  url: string;
  shareText: string;
  label?: string;
  compact?: boolean;
}

export function SocialShareBar({
  url,
  shareText,
  label = 'Partager',
  compact = false,
}: SocialShareBarProps) {
  const { showToast } = useApp();
  const [copied, setCopied] = useState(false);
  const btnPad = compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast('Lien copié dans le presse-papiers.', 'success');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(url, 'info');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 mr-1">
        <Share2 className="w-3.5 h-3.5 text-slate-500" />
        <span>{label} :</span>
      </span>

      <a
        href={whatsappShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur WhatsApp"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:border-orange-500 hover:text-orange-600 font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0 ${btnPad}`}
      >
        <MessageCircle className="w-3.5 h-3.5 text-orange-600" />
        <span>WhatsApp</span>
      </a>

      <a
        href={facebookShareUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur Facebook"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:border-[#0B1528] hover:text-[#0B1528] font-semibold text-slate-700 transition-colors whitespace-nowrap shrink-0 ${btnPad}`}
      >
        <Share2 className="w-3.5 h-3.5 text-[#0B1528]" />
        <span>Facebook</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copier le lien"
        className={`inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${btnPad} ${
          copied
            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white hover:border-slate-400 text-slate-700'
        }`}
      >
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        <span>{copied ? 'Lien copié' : 'Copier le lien'}</span>
      </button>
    </div>
  );
}
