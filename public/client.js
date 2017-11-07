$('.modal-button').on('click', function(e){
  e.preventDefault();
  $('.modal').toggleClass('is-active');
  $("body").addClass("modal-open");
});

$('.modal-close').on('click', function(e){
  e.preventDefault();
  $(this).parents('.modal').toggleClass('is-active');
  $("body").removeClass("modal-open");

});
