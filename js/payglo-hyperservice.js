var hyper;
var paygloWidgets;
var paygloReturnUrl;
var paygloLoaderCustomSettings = {
    message: "",
    css: {
        padding: 0,
        margin: 0,
        width: "30%",
        top: "40%",
        left: "35%",
        textAlign: "center",
        color: "#000",
        border: "3px solid #aaa",
        backgroundColor: "#fff",
        cursor: "wait"
    },
    themedCSS: {
        width: "30%",
        top: "40%",
        left: "35%"
    },
    overlayCSS: {
        backgroundColor: "#fff",
        opacity: .6,
        cursor: "wait"
    },
    growlCSS: {
        width: "350px",
        top: "10px",
        left: "",
        right: "10px",
        border: "none",
        padding: "5px",
        opacity: .6,
        cursor: "default",
        color: "#000",
        backgroundColor: "#fff",
        "-webkit-border-radius": "10px",
        "-moz-border-radius": "10px",
        "border-radius": "10px"
    }
};
var paygloUnifiedCheckoutOptions;
var paygloUnifiedCheckout;
var paygloUpdatePaymentIntentLock = false;
var paygloSdkIsUnlocked = false;
var paygloOrderIsValid = false;

function renderPaygloSDK(publishable_key, client_secret, appearance_obj, return_url, layout, enable_saved_payment_methods) {
    hyper = Hyper(publishable_key);
    publishable_key = publishable_key;
    clientSecret = client_secret;
    paygloReturnUrl = return_url;
    appearance = JSON.parse(appearance_obj);
    if (appearance.variables) {
        variables = appearance.variables;
    } else {
        variables = {};
    }
    if (!variables.fontFamily) {
        var fontFamily = jQuery('#payment, #payment-form, body').css("font-family");
        variables.fontFamily = fontFamily;
    }
    if (!variables.fontSizeBase) {
        var fontSizeBase = jQuery('#payment, #payment-form, body').css("font-size");
        variables.fontSizeBase = fontSizeBase;
    }
    if (!variables.colorPrimary) {
        var colorPrimary = jQuery('#payment, #payment-form, body').css("color");
        variables.colorPrimary = colorPrimary;
    }
    if (!variables.colorText) {
        var colorText = jQuery('#payment, #payment-form, body').css("color");
        variables.colorText = colorText;
    }
    if (!variables.colorTextSecondary) {
        var colorTextSecondary = jQuery('#payment, #payment-form, body').css("color");
        variables.colorTextSecondary = colorStringToHex(colorTextSecondary) + "B3";
    }
    if (!variables.colorPrimaryText) {
        var colorPrimaryText = jQuery('#payment, #payment-form, body').css("color");
        variables.colorPrimaryText = colorPrimaryText;
    }
    if (!variables.colorTextPlaceholder) {
        var colorTextPlaceholder = jQuery('#payment, #payment-form, body').css("color");
        variables.colorTextPlaceholder = colorStringToHex(colorTextPlaceholder) + "50";
    }
    if (!variables.borderColor) {
        var borderColor = jQuery('#payment, #payment-form, body').css("color");
        variables.borderColor = colorStringToHex(borderColor) + "50";
    }
    if (!variables.colorBackground) {
        var colorBackground = jQuery('body').css("background-color");
        variables.colorBackground = colorBackground;
    }

    appearance.variables = variables;

    paygloWidgets = hyper.widgets({ appearance, clientSecret });

    if (checkWcHexIsLight(colorStringToHex(variables.colorBackground))) {
        theme = "dark";
    } else {
        theme = "light";
    }

    style = {
        theme: theme
    }

    var layout1 = {
        type: layout === "spaced" ? "accordion" : layout,
        defaultCollapsed: false,
        radios: true,
        spacedAccordionItems: layout === "spaced",
    }

    var disableSaveCards = !enable_saved_payment_methods;

    paygloUnifiedCheckoutOptions = {
        layout: layout1,
        wallets: {
            walletReturnUrl: paygloReturnUrl,
            style: style
        },
        sdkHandleConfirmPayment: false,
        disableSaveCards: disableSaveCards
    };
    paygloUnifiedCheckout = paygloWidgets.create("payment", paygloUnifiedCheckoutOptions);
    paygloUnifiedCheckout.mount("#unified-checkout");
    jQuery('input[name="_wp_http_referer"]').prepend('<input type="text" class="input-hidden " name="payglo_client_secret" value="' + clientSecret + '">');
}

function handlePaygloAjax() {
    jQuery(".woocommerce-error").remove();
    jQuery("#order_review").block(paygloLoaderCustomSettings);
    clientSecret = jQuery('#payment-form').data('client-secret');
    request = jQuery.ajax({
        type: "post",
        url: "/?wc-ajax=checkout",
        data: jQuery("form.checkout").serialize(),
        success: function (msg) {
            if (msg.result == "success") {
                var payment_intent_data = {
                    action: "create_payment_intent_from_order",
                    order_id: msg.order_id
                }
                if (clientSecret) {
                    payment_intent_data.client_secret = clientSecret;
                }
                if (msg.order_id) {
                    request = jQuery.ajax({
                        type: "post",
                        url: "/wp-admin/admin-ajax.php",
                        data: payment_intent_data,
                        success: function (_msg2) {
                            paygloPaymentHandleSubmit();
                        }
                    });
                } else {
                    jQuery(".payment_box.payment_method_payglo_payment").removeClass("payglo-visible-children");
                }
            } else {
                jQuery("#order_review").unblock();
                jQuery(".woocommerce").prepend(msg.messages);
                jQuery([document.documentElement, document.body]).animate({
                    scrollTop: jQuery(".woocommerce").offset().top
                }, 250);
            }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    jQuery('form.checkout').on("change", function (event) {
        paymentMethod = new URLSearchParams(jQuery("form.checkout").serialize()).get('payment_method');
        // Ignore when other payment method selected, default behaviour is not affected
        if (paymentMethod === "payglo_payment") {
            if (!paygloUpdatePaymentIntentLock) {
                updatePaymentIntent();
            }
        }
    });
});

async function paygloPaymentHandleSubmit() {
    const { error } = await hyper.confirmPayment({
        widgets: paygloWidgets,
        confirmParams: {
            return_url: paygloReturnUrl
        },
        redirect: "if_required"
    });
    if (error) {
        if (error.type) {
            if (error.type == "validation_error") {
                jQuery([document.documentElement, document.body]).animate({
                    scrollTop: jQuery(".payment_box.payment_method_payglo_payment").offset().top
                }, 500);
            } else {
                location.href = paygloReturnUrl;
            }
        }
        else {
            location.href = paygloReturnUrl;
        }
        jQuery("#order_review").unblock();
    } else {
        location.href = paygloReturnUrl;
    }
}

function updatePaymentIntent() {
    paygloUpdatePaymentIntentLock = true;
    jQuery("#order_review").block(paygloLoaderCustomSettings);
    jQuery(".payment_box.payment_method_payglo_payment").removeClass("payglo-visible-children");
    clientSecret = jQuery('#payment-form').data('client-secret');
    request = jQuery.ajax({
        type: "post",
        url: "/?wc-ajax=checkout",
        data: jQuery("form.checkout").serialize(),
        success: function (msg) {
            var payment_intent_data = {
                action: "create_payment_intent_from_order",
                order_id: msg.order_id
            }
            if (clientSecret) {
                payment_intent_data.client_secret = clientSecret;
            }
            paygloOrderIsValid = msg.order_id != null;
            if ((!paygloSdkIsUnlocked && paygloOrderIsValid) || clientSecret == null) {
                request = jQuery.ajax({
                    type: "post",
                    url: "/wp-admin/admin-ajax.php",
                    data: payment_intent_data,
                    success: function (msg2) {
                        if (msg2.order_id) {
                            jQuery(".payment_box.payment_method_payglo_payment").addClass("payglo-visible-children");
                        }
                        if (msg2.payment_sheet) {
                            jQuery(".payment_box.payment_method_payglo_payment").html(msg2.payment_sheet).addClass("payment_sheet");
                        }
                        jQuery("#order_review").unblock(paygloLoaderCustomSettings);
                        paygloUpdatePaymentIntentLock = false;
                    },
                    error: function (_error) {
                        jQuery("#order_review").unblock(paygloLoaderCustomSettings);
                        jQuery(".payment_box.payment_method_payglo_payment").removeClass("payglo-visible-children");
                        paygloUpdatePaymentIntentLock = false;
                    }
                });
            } else if (paygloOrderIsValid) {
                jQuery("#order_review").unblock(paygloLoaderCustomSettings);
                jQuery(".payment_box.payment_method_payglo_payment").addClass("payglo-visible-children");
            } else {
                jQuery("#order_review").unblock(paygloLoaderCustomSettings);
                jQuery(".payment_box.payment_method_payglo_payment").removeClass("payglo-visible-children");
            }
            paygloUpdatePaymentIntentLock = false;
            paygloSdkIsUnlocked = paygloOrderIsValid;
        },
        error: function (_error) {
            jQuery("#order_review").unblock(paygloLoaderCustomSettings);
            paygloUpdatePaymentIntentLock = false;
        }
    })
}

function checkWcHexIsLight(color) {
    const hex = color.replace('#', '');
    const c_r = parseInt(hex.substr(0, 2), 16);
    const c_g = parseInt(hex.substr(2, 2), 16);
    const c_b = parseInt(hex.substr(4, 2), 16);
    const brightness = ((c_r * 299) + (c_g * 587) + (c_b * 114)) / 1000;
    return brightness > 155;
}

function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

function rgbToHex(r, g, b) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function rgbaToHex(r, g, b, a) {
    return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(Math.round(a * 255));
}

function hexToHex(hex) {
    hex = hex.replace('#', '').toUpperCase();
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    return '#' + hex;
}

function colorStringToHex(colorString) {
    if (colorString.startsWith('rgb(')) {
        const values = colorString.substring(4, colorString.length - 1).split(',').map(val => parseInt(val));
        return rgbToHex(values[0], values[1], values[2]);
    } else if (colorString.startsWith('rgba(')) {
        const values = colorString.substring(5, colorString.length - 1).split(',').map(val => parseFloat(val));
        return rgbaToHex(values[0], values[1], values[2], values[3]);
    } else if (colorString.startsWith('#')) {
        return hexToHex(colorString);
    } else {
        throw new Error('Invalid color string');
    }
}

function checkMultiplePaymentMethods() {
    if (jQuery(".wc_payment_methods.payment_methods.methods .wc_payment_method").length > 1) {
        if (jQuery('label[for="payment_method_payglo_payment"]').length) {
            jQuery('label[for="payment_method_payglo_payment"]').css({ display: "inline" });
        }
    }
}
function stopCheckMultiplePaymentMethods() {
    clearInterval(checkMultiplePaymentMethodsInterval)
}
const checkMultiplePaymentMethodsInterval = setInterval(checkMultiplePaymentMethods, 500);
