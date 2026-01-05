<?php

class ByledconfiguratorConfiguratorModuleFrontController extends ModuleFrontController
{
    public function init()
    {
        $this->display_column_left = false;
        $this->display_column_right = false;
        
        parent::init();
    }

    public function initContent()
    {
        // PrestaShop 8 : définir le template AVANT d'appeler parent
        $this->setTemplate('module:byledconfigurator/views/templates/front/configurator.tpl');
        
        parent::initContent();
    }
}
