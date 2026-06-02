
console.log('hov-priser.js lastet');

async function hentPrisForJobbtype() {
  const jobbtype = document.getElementById('jobbType')?.value;
  if(!jobbtype) return;

  const res = await supabaseClient
    .from('hov_priser')
    .select('pris')
    .eq('navn', jobbtype)
    .single();

  if(res.data){
    document.getElementById('arbeidBelop').value = res.data.pris;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('jobbType')
    ?.addEventListener('change', hentPrisForJobbtype);
});
