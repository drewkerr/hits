$(function(){

  var socket = io()
  
  $('form').submit(function(event) {
    event.preventDefault()
    $('#results').text('Searching...')
    var term = $('input').val()
    $('#results').load('/search', { term: term })
  })
  
  $('#results').on('play', 'audio', function() {
    $('audio').not(this).each(function(index, audio) {
      audio.pause()
    })
  })
  
  $('#results').on('click', '.add', function() {
    var data = $.parseJSON($(this).attr('data'))
    $.post('/vote', { data: data })
      .done(function() {
        $('#results').html('')
      })
  })
  
  $('#ranking').on('click', '.up', function() {
    var track = { trackId: $(this).class() }
    $.post('/vote', { data: track, vote: 1 })
      .done(function() {
        
      })
  })
  
});