// ── Razorpay Standard Checkout Helper ─────────────────────
// Key ID is public — safe to use client-side
const RAZORPAY_KEY = import.meta.env.VITE_RAZORPAY_KEY_ID || ''

// Load the Razorpay checkout script dynamically
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// Open Razorpay checkout modal
// Returns: { razorpay_payment_id, razorpay_order_id, razorpay_signature } on success
// Throws on failure / dismissal
export async function openRazorpayCheckout({ amount, booking, onSuccess, onFailure }) {
  const loaded = await loadRazorpayScript()
  if (!loaded) {
    throw new Error('Razorpay SDK load nahi hua. Internet check karo.')
  }
  if (!RAZORPAY_KEY) {
    throw new Error('Razorpay Key ID .env.local mein set nahi hai. Admin → .env.local mein VITE_RAZORPAY_KEY_ID add karo.')
  }

  return new Promise((resolve, reject) => {
    const options = {
      key:         RAZORPAY_KEY,
      amount:      Math.round(amount * 100), // paise
      currency:    'INR',
      name:        booking.company_name || 'Shera Travels',
      description: `${booking.destination || 'Tour'} — ${booking.booking_ref}`,
      image:       '/logo.png',
      prefill: {
        name:    booking.customer_name  || '',
        email:   booking.customer_email || '',
        contact: (booking.customer_whatsapp || booking.customer_phone || '').replace(/\D/g, ''),
      },
      notes: {
        booking_ref: booking.booking_ref || '',
        booking_id:  booking.id          || '',
      },
      theme: { color: '#4F6EF7' },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled by user')),
      },
      handler: (response) => {
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id:   response.razorpay_order_id   || '',
          razorpay_signature:  response.razorpay_signature  || '',
        })
        if (onSuccess) onSuccess(response)
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp.error?.description || 'Payment failed'))
      if (onFailure) onFailure(resp)
    })
    rzp.open()
  })
}

export const isRazorpayConfigured = !!RAZORPAY_KEY
