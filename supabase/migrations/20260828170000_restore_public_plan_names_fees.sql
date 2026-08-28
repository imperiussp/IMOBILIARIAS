update public.subscription_plans
set
  name = case code
    when 'inicial' then 'Start'
    when 'profissional' then 'Pro'
    when 'imobiliaria' then 'Business'
    when 'premium' then 'Prime'
    else name
  end,
  implementation_fee = case code
    when 'inicial' then 9900
    when 'profissional' then 9900
    when 'imobiliaria' then 10000
    when 'premium' then 0
    else implementation_fee
  end,
  updated_at = now()
where code in ('inicial','profissional','imobiliaria','premium');
