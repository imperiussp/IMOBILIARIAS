"use client";

import { useEffect, useState } from "react";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Photo = { id: string; storage_path: string; position: number; is_cover: boolean; alt_text: string | null; signed_url?: string };
type Props = { propertyId: string; propertyTitle: string };

export default function AdminPropertyPhotos({ propertyId, propertyTitle }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabaseBrowser) return;
    const { data, error } = await supabaseBrowser.from("property_photos").select("id,storage_path,position,is_cover,alt_text").eq("property_id", propertyId).order("position");
    if (error) return setMessage(error.message);
    const rows = (data || []) as Photo[];
    const withUrls = await Promise.all(rows.map(async (photo) => ({ ...photo, signed_url: await getPropertyPhotoUrl(photo.storage_path) })));
    setPhotos(withUrls);
  }

  useEffect(() => { void load(); }, [propertyId]);

  async function setCover(photoId: string) {
    if (!supabaseBrowser) return;
    setMessage("");
    const clear = await supabaseBrowser.from("property_photos").update({ is_cover: false }).eq("property_id", propertyId);
    if (clear.error) return setMessage(clear.error.message);
    const apply = await supabaseBrowser.from("property_photos").update({ is_cover: true }).eq("id", photoId);
    if (apply.error) return setMessage(apply.error.message);
    await load();
    setMessage("Foto de capa atualizada.");
  }

  async function move(index: number, direction: -1 | 1) {
    if (!supabaseBrowser) return;
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const a = photos[index]; const b = photos[target];
    const first = await supabaseBrowser.from("property_photos").update({ position: b.position }).eq("id", a.id);
    if (first.error) return setMessage(first.error.message);
    const second = await supabaseBrowser.from("property_photos").update({ position: a.position }).eq("id", b.id);
    if (second.error) return setMessage(second.error.message);
    await load();
  }

  async function remove(photo: Photo) {
    if (!supabaseBrowser) return;
    if (!window.confirm("Excluir esta foto do imóvel?")) return;
    setMessage("");
    const storage = await supabaseBrowser.storage.from("property-photos").remove([photo.storage_path]);
    if (storage.error) return setMessage(storage.error.message);
    const row = await supabaseBrowser.from("property_photos").delete().eq("id", photo.id);
    if (row.error) return setMessage(row.error.message);
    await load();
    setMessage("Foto excluída.");
  }

  return (
    <div className="photoManager">
      <div className="adminPanelHeader"><div><span className="eyebrow">FOTOS</span><h3>{propertyTitle}</h3></div><span>{photos.length} foto(s)</span></div>
      {message ? <div className="formMessage">{message}</div> : null}
      {photos.length === 0 ? <div className="emptyMini">Nenhuma foto cadastrada.</div> : <div className="adminPhotoGrid">{photos.map((photo, index) => <article className="adminPhotoCard" key={photo.id}><div className="adminPhotoImage" style={{ backgroundImage: photo.signed_url ? `url(${photo.signed_url})` : undefined }}>{photo.is_cover ? <span>CAPA</span> : null}</div><div className="adminPhotoActions"><button className="miniButton" onClick={() => void move(index, -1)} disabled={index === 0}>↑</button><button className="miniButton" onClick={() => void move(index, 1)} disabled={index === photos.length - 1}>↓</button><button className="miniButton" onClick={() => void setCover(photo.id)} disabled={photo.is_cover}>Capa</button><button className="miniButton danger" onClick={() => void remove(photo)}>Excluir</button></div></article>)}</div>}
    </div>
  );
}
