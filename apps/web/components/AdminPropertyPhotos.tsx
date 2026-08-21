"use client";

import { useEffect, useState } from "react";
import { prepareBrowserPropertyPhoto } from "../lib/browserImageProcessing";
import { getCurrentAgency } from "../lib/currentAgency";
import { getPropertyPhotoUrl } from "../lib/propertyPhotos";
import { supabaseBrowser } from "../lib/supabaseBrowser";

type Photo = { id: string; storage_path: string; thumbnail_path: string | null; position: number; is_cover: boolean; alt_text: string | null; signed_url?: string };
type Props = { propertyId: string; propertyTitle: string };

export default function AdminPropertyPhotos({ propertyId, propertyTitle }: Props) {
  const [agencyId, setAgencyId] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  async function resolveAgency() {
    if (!supabaseBrowser) return "";
    if (agencyId) return agencyId;
    const currentAgency = await getCurrentAgency();
    if (!currentAgency) return "";
    const property = await supabaseBrowser.from("properties").select("id").eq("id", propertyId).eq("agency_id", currentAgency.agencyId).maybeSingle();
    if (property.error || !property.data) return "";
    setAgencyId(currentAgency.agencyId);
    return currentAgency.agencyId;
  }

  async function load() {
    if (!supabaseBrowser) return;
    const tenantId = await resolveAgency();
    if (!tenantId) return setMessage("Este imóvel não pertence à imobiliária atual.");
    const { data, error } = await supabaseBrowser.from("property_photos").select("id,storage_path,thumbnail_path,position,is_cover,alt_text").eq("property_id", propertyId).order("position");
    if (error) return setMessage(error.message);
    const rows = (data || []) as Photo[];
    const withUrls = await Promise.all(rows.map(async (photo) => ({ ...photo, signed_url: await getPropertyPhotoUrl(photo.thumbnail_path || photo.storage_path) })));
    setPhotos(withUrls);
  }

  useEffect(() => { setAgencyId(""); void load(); }, [propertyId]);

  async function upload(files: FileList | null) {
    if (!supabaseBrowser || !files?.length) return;
    const tenantId = await resolveAgency();
    if (!tenantId) return setMessage("Este imóvel não pertence à imobiliária atual.");
    const selected = Array.from(files).slice(0, Math.max(0, 20 - photos.length));
    if (!selected.length) return setMessage("O imóvel já atingiu o limite de 20 fotos.");
    setUploading(true); setMessage("");
    const createdPaths: string[] = [];
    try {
      let position = photos.length;
      for (const file of selected) {
        const prepared = await prepareBrowserPropertyPhoto(file);
        const token = `${Date.now()}-${position}`;
        const storagePath = `${tenantId}/${propertyId}/admin-edit/${token}.jpg`;
        const thumbnailPath = `${tenantId}/${propertyId}/admin-edit/thumbs/${token}.jpg`;
        const fullUpload = await supabaseBrowser.storage.from("property-photos").upload(storagePath, prepared.full, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (fullUpload.error) throw fullUpload.error;
        createdPaths.push(storagePath);
        const thumbUpload = await supabaseBrowser.storage.from("property-photos").upload(thumbnailPath, prepared.thumbnail, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false });
        if (thumbUpload.error) throw thumbUpload.error;
        createdPaths.push(thumbnailPath);
        const row = await supabaseBrowser.from("property_photos").insert({ property_id: propertyId, storage_path: storagePath, thumbnail_path: thumbnailPath, position, is_cover: photos.length === 0 && position === 0, alt_text: `${propertyTitle} - foto ${position + 1}` });
        if (row.error) throw row.error;
        position += 1;
      }
      await load();
      setMessage(`${selected.length} foto(s) adicionada(s).`);
    } catch (error) {
      if (createdPaths.length) await supabaseBrowser.storage.from("property-photos").remove(createdPaths);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally { setUploading(false); }
  }

  async function setCover(photoId: string) {
    if (!supabaseBrowser || !(await resolveAgency())) return setMessage("Imóvel fora da imobiliária atual.");
    setMessage("");
    const clear = await supabaseBrowser.from("property_photos").update({ is_cover: false }).eq("property_id", propertyId);
    if (clear.error) return setMessage(clear.error.message);
    const apply = await supabaseBrowser.from("property_photos").update({ is_cover: true }).eq("id", photoId).eq("property_id", propertyId);
    if (apply.error) return setMessage(apply.error.message);
    await load(); setMessage("Foto de capa atualizada.");
  }

  async function move(index: number, direction: -1 | 1) {
    if (!supabaseBrowser || !(await resolveAgency())) return setMessage("Imóvel fora da imobiliária atual.");
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const a = photos[index]; const b = photos[target];
    const first = await supabaseBrowser.from("property_photos").update({ position: b.position }).eq("id", a.id).eq("property_id", propertyId);
    if (first.error) return setMessage(first.error.message);
    const second = await supabaseBrowser.from("property_photos").update({ position: a.position }).eq("id", b.id).eq("property_id", propertyId);
    if (second.error) return setMessage(second.error.message);
    await load();
  }

  async function remove(photo: Photo) {
    if (!supabaseBrowser || !window.confirm("Excluir esta foto do imóvel?")) return;
    if (!(await resolveAgency())) return setMessage("Imóvel fora da imobiliária atual.");
    setMessage("");
    const paths = [photo.storage_path, photo.thumbnail_path].filter(Boolean) as string[];
    const storage = await supabaseBrowser.storage.from("property-photos").remove(paths);
    if (storage.error) return setMessage(storage.error.message);
    const row = await supabaseBrowser.from("property_photos").delete().eq("id", photo.id).eq("property_id", propertyId);
    if (row.error) return setMessage(row.error.message);
    await load(); setMessage("Foto excluída.");
  }

  return <div className="photoManager">
    <div className="adminPanelHeader"><div><span className="eyebrow">FOTOS</span><h3>{propertyTitle}</h3></div><span>{photos.length}/20 foto(s)</span></div>
    <label className="uploadBox photoManagerUpload">Adicionar fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || photos.length >= 20} onChange={(event) => { void upload(event.target.files); event.currentTarget.value = ""; }} /><span>{uploading ? "Otimizando e enviando..." : "Selecione novas fotos. O sistema gera versão otimizada e miniatura automaticamente."}</span></label>
    {message ? <div className="formMessage">{message}</div> : null}
    {photos.length === 0 ? <div className="emptyMini">Nenhuma foto cadastrada.</div> : <div className="adminPhotoGrid">{photos.map((photo, index) => <article className="adminPhotoCard" key={photo.id}><div className="adminPhotoImage" style={{ backgroundImage: photo.signed_url ? `url(${photo.signed_url})` : undefined }}>{photo.is_cover ? <span>CAPA</span> : null}</div><div className="adminPhotoActions"><button className="miniButton" onClick={() => void move(index, -1)} disabled={index === 0}>↑</button><button className="miniButton" onClick={() => void move(index, 1)} disabled={index === photos.length - 1}>↓</button><button className="miniButton" onClick={() => void setCover(photo.id)} disabled={photo.is_cover}>Capa</button><button className="miniButton danger" onClick={() => void remove(photo)}>Excluir</button></div></article>)}</div>}
  </div>;
}
