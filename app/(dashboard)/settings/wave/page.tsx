import { ExternalLink, DollarSign, FileText, TrendingUp, AlertCircle } from "lucide-react"

export default function WaveSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">wave financial</h1>
        <p className="text-muted-foreground text-sm mt-1">
          connecter Wave pour synchroniser automatiquement les factures et les transactions
        </p>
      </div>

      {/* Status banner */}
      <div className="flex items-start gap-3 p-4 border border-amber-400/30 bg-amber-400/5">
        <AlertCircle size={14} strokeWidth={1.5} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">non connecté</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            aucun jeton d&apos;accès Wave trouvé dans les variables d&apos;environnement
          </p>
        </div>
      </div>

      {/* What you get when connected */}
      <div className="border border-border bg-card p-5 space-y-4">
        <p className="spatia-label text-xs text-muted-foreground uppercase tracking-widest">
          fonctionnalités disponibles après connexion
        </p>
        <div className="space-y-3">
          {[
            {
              icon: FileText,
              title: "synchronisation automatique des factures",
              desc: "import des factures Wave (statut: payée, envoyée, en retard) toutes les 6 heures",
            },
            {
              icon: DollarSign,
              title: "revenu YTD réel",
              desc: "calcul automatique du seuil 30 000 $ depuis les données Wave",
            },
            {
              icon: TrendingUp,
              title: "détection des factures en retard",
              desc: "alerte automatique dès qu&apos;une facture dépasse sa date d&apos;échéance",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-border bg-card p-5 space-y-4">
        <p className="spatia-label text-xs text-muted-foreground uppercase tracking-widest">
          comment connecter
        </p>
        <ol className="space-y-4">
          <li className="flex items-start gap-3">
            <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 mt-0.5">1.</span>
            <div>
              <p className="text-sm">Créer un jeton d&apos;accès Wave</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visitez{" "}
                <a
                  href="https://developer.waveapps.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline underline-offset-2 inline-flex items-center gap-1"
                >
                  developer.waveapps.com
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>{" "}
                → Applications → Créer une application → Générer un jeton OAuth.
              </p>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 mt-0.5">2.</span>
            <div>
              <p className="text-sm">Ajouter les variables d&apos;environnement</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Dans votre fichier <code className="text-xs bg-muted px-1 py-0.5">.env.local</code> ou dans les variables Railway :
              </p>
              <pre className="bg-muted/30 border border-border p-3 text-xs font-mono text-foreground/80 overflow-x-auto">
{`WAVE_ACCESS_TOKEN=your_access_token_here
WAVE_REFRESH_TOKEN=your_refresh_token_here
WAVE_CLIENT_ID=your_client_id
WAVE_CLIENT_SECRET=your_client_secret
WAVE_BUSINESS_ID=your_business_id`}
              </pre>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 mt-0.5">3.</span>
            <div>
              <p className="text-sm">Redémarrer le serveur</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Après avoir ajouté les variables, redémarrez l&apos;application. La synchronisation
                démarrera automatiquement et le cron job s&apos;exécutera toutes les 6 heures.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* In the meantime */}
      <div className="border border-border/50 p-4 space-y-2">
        <p className="spatia-label text-xs text-muted-foreground">en attendant</p>
        <p className="text-sm text-muted-foreground">
          Utilisez{" "}
          <a href="/money/import-wave" className="text-foreground hover:underline underline-offset-2">
            Import Wave CSV
          </a>{" "}
          pour importer manuellement vos données depuis Wave. Toutes les factures saisies manuellement
          dans{" "}
          <a href="/money/invoices" className="text-foreground hover:underline underline-offset-2">
            Money → Factures
          </a>{" "}
          continuent de fonctionner normalement.
        </p>
      </div>
    </div>
  )
}
