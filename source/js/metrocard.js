

// TODO: try math.js library


var args = process.argv.slice(2);

var max_card_value = 50;

var fare = 2.5;

var bonus = 1.05;
var bonus_min = 5;

console.log(args);

var initial_value = parseFloat(args[0], 10);

for (var i = 2; i <= (max_card_value / fare); i++) {
  var target = i * fare;
  var purchase = (target - initial_value) / bonus;
  if (target < initial_value || purchase < bonus_min) {
    continue;
  }


  if (Math.round(purchase * 100) % 5 === 0) {
    console.log('initial value: $%s;  target: $%s;  purchase: $%s', args[0], target.toFixed(2), purchase.toFixed(2));
  } else {
    console.log('      initial value: $%s;  target: $%s;  purchase: $%s', args[0], target.toFixed(2), purchase.toFixed(2));
  }

  // console.log('initial value: $%s;  target: $%s;  purchase: $%s', args[0], target.toFixed(2), purchase.toFixed(4));
  console.log();
};



/*

  Metrocard Zero

  I don't know yet whether the MTA is [salami slicing](http://en.wikipedia.org/wiki/Salami_slicing) decimals,

  Metrocard shape: http://codepen.io/joemaller/pen/sidIJ


 */