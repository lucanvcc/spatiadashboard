import { ExternalLink, Box, Activity, AlertCircle, BarChart2 } from "lucide-react"

export default function MatterportSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-xl tracking-tight">matterport api</h1>
        <p className="text-muted-foreground text-sm mt-1">
          connecter l&apos;API Matterport pour synchroniser automatiquement vos espaces 3D
        </p>
      </div>

      {/* Status banner */}
      <div className="flex items-start gap-3 p-4 border border-amber-400/30 bg-amber-400/5">
        <AlertCircle size={14} strokeWidth={1.5} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">non connecté</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            aucun identifiant API Matterport trouvé dans les variables d&apos;environnement
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
              icon: Box,
              title: "inventaire automatique des espaces",
              desc: "liste complète de vos modèles Matterport avec statut (actif, archivé, en traitement)",
            },
            {
              icon: BarChart2,
              title: "suivi des slots en temps réel",
              desc: "comptage actif/total avec alerte automatique à 80% d&apos;utilisation",
            },
            {
              icon: Activity,
              title: "détection de fin de traitement",
              desc: "quand un espace passe en statut «prêt», le shoot associé est automatiquement mis à jour",
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
              <p className="text-sm">Générer un jeton API Matterport</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connectez-vous à{" "}
                <a
                  href="https://my.matterport.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:underline underline-offset-2 inline-flex items-center gap-1"
                >
                  my.matterport.com
                  <ExternalLink size={10} strokeWidth={1.5} />
                </a>{" "}
                → Paramètres du compte → Developer Tools → Créer un jeton API.
                Notez l&apos;ID du jeton et le secret.
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
{`MATTERPORT_TOKEN_ID=your_token_id_here
MATTERPORT_TOKEN_SECRET=your_token_secret_here`}
              </pre>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="font-mono text-xs text-muted-foreground w-5 shrink-0 mt-0.5">3.</span>
            <div>
              <p className="text-sm">Redémarrer le serveur</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Après avoir ajouté les variables, redémarrez l&apos;application. La synchronisation
                Matterport s&apos;exécutera toutes les 12 heures et le nombre de slots actifs
                sera mis à jour automatiquement.
              </p>
            </div>
          </li>
        </ol>
      </div>

      {/* In the meantime */}
      <div className="border border-border/50 p-4 space-y-2">
        <p className="spatia-label text-xs text-muted-foreground">en attendant</p>
        <p className="text-sm text-muted-foreground">
          Le suivi des slots fonctionne toujours manuellement via{" "}
          <a href="/operations/tours" className="text-foreground hover:underline underline-offset-2">
            Opérations → Matterport
          </a>
          . La limite de slots est configurable dans{" "}
          <a href="/settings/goals" className="text-foreground hover:underline underline-offset-2">
            Paramètres → Objectifs
          </a>
          .
        </p>
      </div>
    </div>
  )
}
