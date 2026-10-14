import { Link } from "react-router-dom";
import { Button, PageHeader } from "../../components/ui";
import { markerSvg } from "../../lib/markers";
import { scenes } from "./scenes";

/** Printable ArUco markers, one per curated scene. */
export function MarkersPage() {
  return (
    <div className="max-w-4xl">
      <PageHeader title="Printable markers" description="Print this page (or show it on a phone), start the camera in Visual Learning Studio, turn on marker detection, and hold a marker in view. ORBIT opens the matching scene."
        action={<div className="flex gap-2 print:hidden"><Button onClick={() => window.print()}>Print</Button><Link to="/visual" className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:border-muted">Back</Link></div>} />
      <div className="grid gap-6 sm:grid-cols-2">
        {scenes.map((s) => (
          <figure key={s.id} className="rounded-lg border border-line bg-white p-4 text-black">
            {/* The SVG is generated locally from the marker id by js-aruco2; it contains only rectangles. */}
            <div className="mx-auto aspect-square w-full max-w-64" dangerouslySetInnerHTML={{ __html: markerSvg(s.markerId) }} />
            <figcaption className="mt-3 text-center text-sm"><b>Marker #{s.markerId}</b>: {s.title}</figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted print:hidden">Markers use the ArUco ARUCO_MIP_36h12 dictionary. Keep the white margin around each marker; print at least 5 cm wide.</p>
    </div>
  );
}
