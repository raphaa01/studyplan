import Link from "next/link";

export default function NotFound() {
  return <div className="empty-page"><p className="eyebrow">404</p><h1>Diese Seite steht nicht im Plan.</h1><p>Zurück zur Übersicht – dort wartet dein nächster sinnvoller Schritt.</p><Link href="/" className="button button-primary">Zur Übersicht</Link></div>;
}
