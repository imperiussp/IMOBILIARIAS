-- Consolida policies permissivas duplicadas em fluxos centrais sem ampliar o escopo efetivo.

-- ASSETS
DROP POLICY IF EXISTS "tenant managers manage asset registry" ON public.agency_assets;
DROP POLICY IF EXISTS "tenant members read asset registry" ON public.agency_assets;
CREATE POLICY "tenant members read asset registry" ON public.agency_assets
FOR SELECT TO authenticated
USING (is_agency_member(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers insert asset registry" ON public.agency_assets
FOR INSERT TO authenticated
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers update asset registry" ON public.agency_assets
FOR UPDATE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin())
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers delete asset registry" ON public.agency_assets
FOR DELETE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin());

-- DOCUMENT VERSIONS
DROP POLICY IF EXISTS "tenant managers manage document versions" ON public.agency_document_versions;
DROP POLICY IF EXISTS "tenant members read document versions" ON public.agency_document_versions;
CREATE POLICY "tenant members read document versions" ON public.agency_document_versions
FOR SELECT TO authenticated
USING (is_agency_member(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers insert document versions" ON public.agency_document_versions
FOR INSERT TO authenticated
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers update document versions" ON public.agency_document_versions
FOR UPDATE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin())
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers delete document versions" ON public.agency_document_versions
FOR DELETE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin());

-- DOCUMENTS
DROP POLICY IF EXISTS "tenant managers manage documents" ON public.agency_documents;
DROP POLICY IF EXISTS "tenant members read documents" ON public.agency_documents;
CREATE POLICY "tenant members read documents" ON public.agency_documents
FOR SELECT TO authenticated
USING (is_agency_member(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers insert documents" ON public.agency_documents
FOR INSERT TO authenticated
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers update documents" ON public.agency_documents
FOR UPDATE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin())
WITH CHECK (can_manage_agency(agency_id) OR is_platform_admin());
CREATE POLICY "tenant managers delete documents" ON public.agency_documents
FOR DELETE TO authenticated
USING (can_manage_agency(agency_id) OR is_platform_admin());

-- DOMAINS
DROP POLICY IF EXISTS "platform admins manage all domains" ON public.agency_domains;
DROP POLICY IF EXISTS "platform admins read all domains" ON public.agency_domains;
DROP POLICY IF EXISTS "members read own domains" ON public.agency_domains;
DROP POLICY IF EXISTS "tenant managers add custom domains" ON public.agency_domains;
DROP POLICY IF EXISTS "tenant managers remove custom domains" ON public.agency_domains;
CREATE POLICY "members or platform admins read domains" ON public.agency_domains
FOR SELECT TO authenticated
USING ((agency_id IN (SELECT current_agency_ids())) OR is_admin());
CREATE POLICY "platform admins or tenant managers insert domains" ON public.agency_domains
FOR INSERT TO authenticated
WITH CHECK (
  is_admin()
  OR (
    can_manage_agency(agency_id)
    AND kind = 'custom'
    AND verified = false
    AND verified_at IS NULL
    AND is_primary = false
  )
);
CREATE POLICY "platform admins update domains" ON public.agency_domains
FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());
CREATE POLICY "platform admins or tenant managers delete domains" ON public.agency_domains
FOR DELETE TO authenticated
USING (is_admin() OR (can_manage_agency(agency_id) AND kind = 'custom'));

-- LEADS
DROP POLICY IF EXISTS "tenant managers manage leads" ON public.leads;
DROP POLICY IF EXISTS "tenant brokers read own leads" ON public.leads;
DROP POLICY IF EXISTS "tenant brokers update own leads" ON public.leads;
DROP POLICY IF EXISTS "public create tenant lead" ON public.leads;
CREATE POLICY "anonymous create tenant lead" ON public.leads
FOR INSERT TO anon
WITH CHECK (
  agency_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.agencies a
    WHERE a.id = leads.agency_id
      AND a.status = ANY (ARRAY['trial'::text,'active'::text,'past_due'::text])
  )
  AND (
    property_id IS NULL OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = leads.property_id
        AND p.agency_id = leads.agency_id
        AND p.publication_state = 'published'::publication_state
        AND p.status = ANY (ARRAY['available'::property_status,'reserved'::property_status,'rented'::property_status,'sold'::property_status])
    )
  )
  AND (
    broker_id IS NULL OR EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = leads.broker_id
        AND b.agency_id = leads.agency_id
        AND b.active = true
    )
  )
);
CREATE POLICY "authenticated create permitted tenant leads" ON public.leads
FOR INSERT TO authenticated
WITH CHECK (
  can_manage_agency(agency_id)
  OR (
    agency_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.agencies a
      WHERE a.id = leads.agency_id
        AND a.status = ANY (ARRAY['trial'::text,'active'::text,'past_due'::text])
    )
    AND (
      property_id IS NULL OR EXISTS (
        SELECT 1 FROM public.properties p
        WHERE p.id = leads.property_id
          AND p.agency_id = leads.agency_id
          AND p.publication_state = 'published'::publication_state
          AND p.status = ANY (ARRAY['available'::property_status,'reserved'::property_status,'rented'::property_status,'sold'::property_status])
      )
    )
    AND (
      broker_id IS NULL OR EXISTS (
        SELECT 1 FROM public.brokers b
        WHERE b.id = leads.broker_id
          AND b.agency_id = leads.agency_id
          AND b.active = true
      )
    )
  )
);
CREATE POLICY "tenant managers or assigned brokers read leads" ON public.leads
FOR SELECT TO authenticated
USING (
  can_manage_agency(agency_id)
  OR EXISTS (
    SELECT 1 FROM public.brokers b
    WHERE b.id = leads.broker_id
      AND b.agency_id = leads.agency_id
      AND b.user_id = (SELECT auth.uid())
      AND b.active = true
  )
);
CREATE POLICY "tenant managers or assigned brokers update leads" ON public.leads
FOR UPDATE TO authenticated
USING (
  can_manage_agency(agency_id)
  OR EXISTS (
    SELECT 1 FROM public.brokers b
    WHERE b.id = leads.broker_id
      AND b.agency_id = leads.agency_id
      AND b.user_id = (SELECT auth.uid())
      AND b.active = true
  )
)
WITH CHECK (
  can_manage_agency(agency_id)
  OR EXISTS (
    SELECT 1 FROM public.brokers b
    WHERE b.id = leads.broker_id
      AND b.agency_id = leads.agency_id
      AND b.user_id = (SELECT auth.uid())
      AND b.active = true
  )
);
CREATE POLICY "tenant managers delete leads" ON public.leads
FOR DELETE TO authenticated
USING (can_manage_agency(agency_id));

-- PROPERTIES
DROP POLICY IF EXISTS "tenant brokers manage assigned properties" ON public.properties;
DROP POLICY IF EXISTS "tenant managers manage properties" ON public.properties;
CREATE POLICY "tenant managers or assigned brokers read properties" ON public.properties
FOR SELECT TO authenticated
USING (
  can_manage_agency(agency_id)
  OR (
    can_sell_for_agency(agency_id)
    AND EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = properties.broker_id
        AND b.agency_id = properties.agency_id
        AND b.user_id = (SELECT auth.uid())
        AND b.active = true
    )
  )
);
CREATE POLICY "tenant managers or assigned brokers insert properties" ON public.properties
FOR INSERT TO authenticated
WITH CHECK (
  can_manage_agency(agency_id)
  OR (
    can_sell_for_agency(agency_id)
    AND EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = properties.broker_id
        AND b.agency_id = properties.agency_id
        AND b.user_id = (SELECT auth.uid())
        AND b.active = true
    )
  )
);
CREATE POLICY "tenant managers or assigned brokers update properties" ON public.properties
FOR UPDATE TO authenticated
USING (
  can_manage_agency(agency_id)
  OR (
    can_sell_for_agency(agency_id)
    AND EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = properties.broker_id
        AND b.agency_id = properties.agency_id
        AND b.user_id = (SELECT auth.uid())
        AND b.active = true
    )
  )
)
WITH CHECK (
  can_manage_agency(agency_id)
  OR (
    can_sell_for_agency(agency_id)
    AND EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = properties.broker_id
        AND b.agency_id = properties.agency_id
        AND b.user_id = (SELECT auth.uid())
        AND b.active = true
    )
  )
);
CREATE POLICY "tenant managers or assigned brokers delete properties" ON public.properties
FOR DELETE TO authenticated
USING (
  can_manage_agency(agency_id)
  OR (
    can_sell_for_agency(agency_id)
    AND EXISTS (
      SELECT 1 FROM public.brokers b
      WHERE b.id = properties.broker_id
        AND b.agency_id = properties.agency_id
        AND b.user_id = (SELECT auth.uid())
        AND b.active = true
    )
  )
);

-- PROPERTY PHOTOS
DROP POLICY IF EXISTS "tenant brokers manage assigned property photos" ON public.property_photos;
DROP POLICY IF EXISTS "tenant managers manage property photos" ON public.property_photos;
CREATE POLICY "tenant managers or assigned brokers read property photos" ON public.property_photos
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_photos.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers insert property photos" ON public.property_photos
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_photos.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers update property photos" ON public.property_photos
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_photos.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_photos.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers delete property photos" ON public.property_photos
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_photos.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);

-- PROPERTY FEATURE LINKS
DROP POLICY IF EXISTS "tenant brokers manage assigned feature links" ON public.property_feature_links;
DROP POLICY IF EXISTS "tenant managers manage feature links" ON public.property_feature_links;
CREATE POLICY "tenant managers or assigned brokers read feature links" ON public.property_feature_links
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_feature_links.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers insert feature links" ON public.property_feature_links
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_feature_links.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers update feature links" ON public.property_feature_links
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_feature_links.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_feature_links.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);
CREATE POLICY "tenant managers or assigned brokers delete feature links" ON public.property_feature_links
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    LEFT JOIN public.brokers b ON b.id = p.broker_id AND b.agency_id = p.agency_id
    WHERE p.id = property_feature_links.property_id
      AND (
        can_manage_agency(p.agency_id)
        OR (b.user_id = (SELECT auth.uid()) AND b.active = true AND can_sell_for_agency(p.agency_id))
      )
  )
);