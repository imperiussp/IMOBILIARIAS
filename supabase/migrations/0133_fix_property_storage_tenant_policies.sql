-- Corrige as policies autenticadas do bucket property-photos.
-- A versão anterior ligava o parser do caminho a b.name (nome do corretor)
-- dentro do subselect, em vez do caminho real storage.objects.name.
-- Também reforça WITH CHECK no UPDATE para impedir mover/renomear objeto
-- para um imóvel/tenant que o usuário não administra.

DROP POLICY IF EXISTS "tenant members read managed property storage" ON storage.objects;
DROP POLICY IF EXISTS "tenant update managed property storage" ON storage.objects;
DROP POLICY IF EXISTS "tenant delete managed property storage" ON storage.objects;

CREATE POLICY "tenant members read managed property storage"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND public.storage_matches_tenant_property(storage.objects.name)
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.brokers b
      ON b.id = p.broker_id
     AND b.agency_id = p.agency_id
    WHERE p.id = public.storage_tenant_property_id(storage.objects.name)
      AND p.agency_id = public.storage_agency_id(storage.objects.name)
      AND (
        public.can_manage_agency(p.agency_id)
        OR (b.user_id = auth.uid() AND b.active = true)
      )
  )
);

CREATE POLICY "tenant update managed property storage"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND public.storage_matches_tenant_property(storage.objects.name)
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.brokers b
      ON b.id = p.broker_id
     AND b.agency_id = p.agency_id
    WHERE p.id = public.storage_tenant_property_id(storage.objects.name)
      AND p.agency_id = public.storage_agency_id(storage.objects.name)
      AND (
        public.can_manage_agency(p.agency_id)
        OR (b.user_id = auth.uid() AND b.active = true)
      )
  )
)
WITH CHECK (
  bucket_id = 'property-photos'
  AND public.storage_matches_tenant_property(storage.objects.name)
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.brokers b
      ON b.id = p.broker_id
     AND b.agency_id = p.agency_id
    WHERE p.id = public.storage_tenant_property_id(storage.objects.name)
      AND p.agency_id = public.storage_agency_id(storage.objects.name)
      AND (
        public.can_manage_agency(p.agency_id)
        OR (b.user_id = auth.uid() AND b.active = true)
      )
  )
);

CREATE POLICY "tenant delete managed property storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-photos'
  AND public.storage_matches_tenant_property(storage.objects.name)
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    LEFT JOIN public.brokers b
      ON b.id = p.broker_id
     AND b.agency_id = p.agency_id
    WHERE p.id = public.storage_tenant_property_id(storage.objects.name)
      AND p.agency_id = public.storage_agency_id(storage.objects.name)
      AND (
        public.can_manage_agency(p.agency_id)
        OR (b.user_id = auth.uid() AND b.active = true)
      )
  )
);
