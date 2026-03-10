document.getElementById("openWhatsapp").addEventListener("click", () => {
  const phone = document
    .getElementById("phone")
    .value.replace(/\D/g, "");

  if (!phone) {
    alert("Enter a valid phone number");
    return;
  }

  window.location.href = `https://wa.me/91${phone}`;
});
