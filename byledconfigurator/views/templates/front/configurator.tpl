{extends file='page.tpl'}

{block name='page_content'}
  <div class="byledconfigurator-page" style="padding: 20px;">
    <h1>Configurateur BYLED</h1>

    <iframe
      id="byled-iframe"
      src="/modules/byledconfigurator/public/index.html"
      style="width: 100%; height: 85vh; border: 1px solid #ccc; border-radius: 8px;"
      loading="lazy"
    ></iframe>
  </div>
{/block}
