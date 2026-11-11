<?php
/**
 * Plugin Name:       PM Radar – Autoevaluación de Product Manager
 * Description:       Cuestionario de autoevaluación para Product Managers basado en hechos, con radar de capacidad e importancia. Shortcode: [pm-radar] o [pm-radar discovery="si"].
 * Version:           0.2.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            pabloalcedo
 * License:           GPL-2.0-or-later
 * Text Domain:       pm-radar
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PMR_VERSION', '0.2.0' );

add_action( 'wp_enqueue_scripts', 'pmr_register_assets' );

function pmr_register_assets() {
	wp_register_style( 'pm-radar', plugins_url( 'assets/pm-radar.css', __FILE__ ), array(), PMR_VERSION );
	wp_register_script( 'pm-radar', plugins_url( 'assets/pm-radar.js', __FILE__ ), array(), PMR_VERSION, true );
}

add_shortcode( 'pm-radar', 'pmr_shortcode' );

/**
 * [pm-radar]                 → versión pública.
 * [pm-radar discovery="si"]  → añade "cómo te ves", comparación percepción/hechos y exportación de resultados.
 */
function pmr_shortcode( $atts ) {
	static $instance = 0;

	$atts = shortcode_atts( array( 'discovery' => 'no' ), $atts, 'pm-radar' );

	$file = plugin_dir_path( __FILE__ ) . 'data/preguntas.json';
	$data = file_exists( $file ) ? json_decode( file_get_contents( $file ), true ) : null;

	if ( ! is_array( $data ) || empty( $data['preguntas'] ) ) {
		return current_user_can( 'manage_options' )
			? '<p><strong>PM Radar:</strong> no se ha podido leer data/preguntas.json.</p>'
			: '';
	}

	wp_enqueue_style( 'pm-radar' );
	wp_enqueue_script( 'pm-radar' );

	$discovery = in_array( strtolower( trim( $atts['discovery'] ) ), array( 'si', 'sí', 'yes', '1', 'true' ), true );
	$instance++;

	$json = wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP );

	return sprintf(
		'<div class="pmr" id="pm-radar-%1$d" data-discovery="%2$s"><script type="application/json" class="pmr-data">%3$s</script><noscript>Este cuestionario necesita JavaScript.</noscript></div>',
		$instance,
		$discovery ? '1' : '0',
		$json
	);
}
