<?php
if (!defined('_PS_VERSION_')) {
    exit;
}

class Byledconfigurator extends Module
{
    public function __construct()
    {
        $this->name = 'byledconfigurator';
        $this->tab = 'front_office_features';
        $this->version = '0.1.0';
        $this->author = 'Byled';
        $this->need_instance = 0;
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l('BYLED Configurator');
        $this->description = $this->l('Adds a BYLED configurator to your shop.');
    }

    public function install()
    {
        return parent::install()
            && $this->registerHook('displayTop');
    }

    public function uninstall()
    {
        return parent::uninstall();
    }

    public function getContent()
    {
        return '<div class="alert alert-info">'.$this->l('Module installed. Configuration will be added soon.').'</div>';
    }

    /**
     * Hook displayTop - Affiche le lien dans le menu horizontal
     * Compatible PrestaShop 1.6 - S'intègre au menu Women/Dresses/T-shirt
     */
    public function hookDisplayTop($params)
    {
        $configuratorUrl = $this->context->link->getModuleLink('byledconfigurator', 'configurator');
        
        // CSS inline pour s'intégrer au menu horizontal
        $html = '<style>
            .byled-top-menu {
                display: inline-block;
                vertical-align: top;
            }
            .byled-top-menu a {
                display: inline-block;
                padding: 12px 18px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff !important;
                text-decoration: none !important;
                font-weight: 600;
                font-size: 14px;
                text-transform: uppercase;
                transition: all 0.3s ease;
                border-radius: 3px;
                margin: 5px 10px;
            }
            .byled-top-menu a:hover {
                background: linear-gradient(135deg, #764ba2 0%, #667eea 100%);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
            }
        </style>';
        
        // Bloc standalone qui s'affichera après le menu horizontal
        $html .= '<div class="byled-top-menu">
            <a href="'.Tools::safeOutput($configuratorUrl).'" 
               title="'.$this->l('Configurateur de rubans LED digitaux').'">
                💡 '.$this->l('Configurateur LED').'
            </a>
        </div>';
        
        return $html;
    }
}
