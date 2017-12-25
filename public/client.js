$(function(){

  var socket = io()
  
  socket.on('refresh', function(list) {
    appendRows('#ranking tbody', list, true)
    $('#ranking tbody tr').order()
  })

  socket.on('added', function(data) {
    appendRows('#ranking tbody', data.song, false)
    $('#ranking tbody tr').order()
    $('#' + data.song[0].trackId).highlight()
    $('#' + data.song[0].trackId + ' > .preview img').message(data.name)
  })
  
  socket.on('voted', function(data) {
    $('#' + data.trackId + ' > .votes').text(data.votes)
    $('#ranking tbody tr').order()
    $('#' + data.trackId).highlight()
    $('#' + data.trackId + ' > .preview img').message(data.name, data.up ? 'green' : 'red')
  })
  
  $('form').submit(function(event) {
    event.preventDefault()
    var term = $('input').val()
    $('#results').html('<div>Searching...</div>')
    socket.emit('search', term, function(data) {
      if (data.resultCount == 0) {
        $('#results').html('<div>No results.</div>')
      } else {
        $('#results').html('')
        $.each(data.results, function(i, song) {
          $('#results').append('<div data-track="'+song.trackId+
                               '"><img src="'+song.artworkUrl100+
                               '">'+song.trackName+'<br><em>'+song.artistName+'</em></div>')
        })
        $('#results div').click(function() {
          var trackId = $(this).data('track')
          socket.emit('add', trackId)
          $('#results').html('')
          $('input').val('')
        })
      }
    })
  })
  
  $('<span class="clearinput">&#9587;</span>').click(function() {
    $('#results').html('')
    $(this).prev('input').val('').trigger('change').focus()
  }).insertAfter('input')
  
  function appendRows(table, data, replace) {
    if (replace) {
        $(table).html('')
      }
    $.each(data, function(i, song) {
      var disabled = song.voted ? 'disabled' : ''
      var row = $('<tr id="'+song.trackId+'"></tr>')
      row.append('<td><button class="upvote" '+disabled+'>+</button></td>')
         .append('<td class="votes">'+song.votes+'</td>')
         .append('<td><button class="downvote" '+disabled+'>-</button></td>')
         .append('<td class="preview"><img src="'+song.artworkUrl100+'"><audio preload="none" src="'+song.previewUrl+'"></td>')
         .append('<td>'+song.trackName+'<br><em>'+song.artistName+'</em></td>')
      $(table).append(row)
    })
  }
  
  $('#ranking').on('click', 'td button', function() {
    var action = $(this).attr('class')
    var trackId = $(this).closest('tr').prop('id')
    $('#' + trackId + ' button').prop('disabled', true)
    socket.emit(action, trackId)
  })
  
  $('#ranking').on('click', '.preview img', function() {
    // play state
    var audio = $(this).next('audio')[0]
    $('audio').not(audio).each(function(index, other) {
      other.pause() // pause all other audio
    })
    audio[audio.paused ? 'play' : 'pause']()
    // button appearance
    $('.play').not(this).removeClass('play')
    $(this).toggleClass('play')
    $(audio).on('ended', function() {
      $(this).prev('.play').removeClass('play')
    })
    // status message
    var msg = $(this).hasClass('play') ? "&#9654;" : "&#9646;&#9646;"
    $(this).message(msg)
  })
  
  jQuery.fn.highlight = function() {
    $(this).addClass('highlight').delay(2000).queue(function(){
      $(this).removeClass('highlight').dequeue()
    })
  }
  
  jQuery.fn.message = function(msg, colour) {
    $('<div class="message ' + colour + '">'+msg+'</div>').insertBefore(this).delay(2000).queue(function() {
      $(this).remove()
    })
  }
  
  jQuery.fn.order = function(asc, fn) {
    fn = fn || function (el) {
      return parseInt($('td:eq(1)',el).text())
      //return $.trim($('td:eq(1)',el).text())
      //return $(el).text().replace(/^\s+|\s+$/g,'');
    }
    var T = asc == true ? 1 : -1,
        F = asc == true ? -1 : 1
    this.sort(function (a, b) {
        a = fn(a), b = fn(b)
        if (a == b) return 0
        return a < b ? F : T
    })
    this.each(function (i) {
        this.parentNode.appendChild(this)
    })
  }
})