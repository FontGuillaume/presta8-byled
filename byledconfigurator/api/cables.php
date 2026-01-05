<?php

// Headers de sécurité communs
require_once __DIR__ . '/common/security-headers.php';

// Charger PrestaShop pour accès aux classes et constantes
require_once __DIR__ . '/../../../config/config.inc.php';

require_once __DIR__ . '/../src/Services/ConfiguratorService.php';

// Fonction commune pour récupérer les données PrestaShop
require_once __DIR__ . '/common/prestashop-functions.php';

try {
    $service = new ConfiguratorService();
    $cables = $service->getAllCables();
    
    $result = [];
    foreach ($cables as $cable) {
        // Chercher le produit dans PrestaShop par référence
        $psData = getPrestashopProductData($cable->reference);
        
        // Utiliser les données PS si trouvées, sinon fallback sur JSON
        $price = $psData ? (float)$psData['price'] : $cable->pricePerMeter;
        $stock = $psData ? (int)$psData['quantity'] : null;
        
        // Pour l'image : si pas d'image PS OU si l'image n'a pas d'ID, utiliser celle du JSON
        $imageUrl = $cable->imageUrl; // Défaut = image du JSON
        if ($psData && !empty($psData['id_image'])) {
            // Si PrestaShop a une image, l'utiliser
            $imageUrl = $psData['image_url'];
        }
        
        $result[] = [
            'id' => $cable->id,
            'name' => $cable->name,
            'reference' => $cable->reference,
            'wire_count' => $cable->wireCount,
            'section' => $cable->section,
            'usage' => $cable->usage,
            'price_per_meter' => $price,
            'stock' => $stock,
            'in_stock' => $stock !== null && $stock > 0,
            'ps_linked' => $psData !== null,
            'image_url' => $imageUrl,
            'id_product' => $psData ? (int)$psData['id_product'] : null,
            'link_rewrite' => $psData ? $psData['link_rewrite'] : null
        ];
    }

    echo json_encode($result, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erreur lors de la récupération des câbles',
        'code' => 'CABLES_FETCH_ERROR'
    ]);
    error_log('cables.php error: ' . $e->getMessage());
}