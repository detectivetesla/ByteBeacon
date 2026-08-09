import React, { useState } from 'react';
import { Copy, Share2, Check, ExternalLink, Globe } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface StoreLinkSectionProps {
    storeName: string;
    slug: string;
}

export const StoreLinkSection: React.FC<StoreLinkSectionProps> = ({ storeName, slug }) => {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const publicUrl = `${window.location.origin}/store/${slug}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        toast({ title: 'Link Copied!', description: 'Store link copied to your clipboard.' });
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: storeName,
                    text: `Buy affordable data bundles on ${storeName}!`,
                    url: publicUrl,
                });
            } catch (err) {
                // User cancelled or share failed
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="bg-[#202227] p-6 rounded-2xl border border-white/5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#a3e635]/10 flex items-center justify-center text-[#a3e635]">
                        <Globe className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-base">Your Public Storefront</h3>
                        <p className="text-xs text-slate-400">Share your storefront link to take orders.</p>
                    </div>
                </div>
                <a
                    href={`/store/${slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-[#18191c] text-slate-400 hover:text-white border border-white/5 transition-all"
                    title="Open Store Preview"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#18191c] p-3 rounded-xl border border-white/5 overflow-hidden">
                <span className="text-xs font-mono text-[#a3e635] truncate max-w-full flex-1 px-2 text-center sm:text-left break-all">
                    {publicUrl}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={handleCopy}
                        className="flex-1 sm:flex-none px-4 py-2 bg-[#202227] hover:bg-[#26282e] text-white font-semibold rounded-lg border border-white/10 text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-[#a3e635]" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy Link'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 sm:flex-none px-4 py-2 bg-[#a3e635] hover:bg-[#b5f73c] text-black font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#a3e635]/20"
                    >
                        <Share2 className="w-3.5 h-3.5" />
                        Share Store
                    </button>
                </div>
            </div>
        </div>
    );
};
