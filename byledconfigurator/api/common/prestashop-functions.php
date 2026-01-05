<?php
/**
 * Fonctions communes pour l'interaction avec PrestaShop
 * À inclure dans les APIs qui ont besoin d'accéder aux données PrestaShop
 */

/**
 * Récupère les données d'un produit PrestaShop par référence
 * @param string $reference Référence du produit
 * @return array|null Données du produit ou null si non trouvé
 */
function getPrestashopProductData($reference) {
    try {
        // Vérifier que les classes PrestaShop sont disponibles
        if (!class_exists('Db') || !class_exists('Context')) {
            error_log('getPrestashopProductData: Classes PrestaShop non disponibles');
            return null;
        }
        
        // Utiliser la langue du contexte PrestaShop
        $idLang = (int)Context::getContext()->language->id;
        
        // Requête SQL avec _DB_PREFIX_ pour compatibilité universelle
        $sql = "SELECT p.id_product, p.price, p.active,
                       s.quantity,
                       i.id_image,
                       pl.link_rewrite
                FROM " . _DB_PREFIX_ . "product p
                LEFT JOIN " . _DB_PREFIX_ . "stock_available s 
                    ON p.id_product = s.id_product 
                    AND s.id_product_attribute = 0
                LEFT JOIN " . _DB_PREFIX_ . "image i
                    ON p.id_product = i.id_product
                    AND i.cover = 1
                LEFT JOIN " . _DB_PREFIX_ . "product_lang pl
                    ON p.id_product = pl.id_product
                    AND pl.id_lang = " . $idLang . "
                WHERE p.reference = '" . pSQL($reference) . "'
                LIMIT 1";
        
        // Utiliser Db::getInstance()->executeS()
        $results = Db::getInstance()->executeS($sql);
        
        if (!$results || count($results) === 0) {
            // Produit non trouvé (normal si pas dans PrestaShop)
            return null;
        }
        
        // Prendre le premier résultat
        $result = $results[0];
        
        // Construire l'URL de l'image si elle existe (format PrestaShop)
        if ($result['id_image']) {
            $idImage = $result['id_image'];
            // PrestaShop stocke les images dans /img/p/{chiffres}/{id}-large_default.jpg
            // Ex: id=123 → /img/p/1/2/3/123-large_default.jpg
            $path = '';
            $imageIdStr = (string)$idImage;
            for ($i = 0; $i < strlen($imageIdStr); $i++) {
                $path .= $imageIdStr[$i] . '/';
            }
            $result['image_url'] = "/img/p/" . $path . $idImage . "-large_default.jpg";
        }
        
        return $result;
        
    } catch (Exception $e) {
        error_log('getPrestashopProductData error for ' . $reference . ': ' . $e->getMessage());
        return null;
    }
}
