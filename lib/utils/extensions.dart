import 'dart:math';

List<T> shuffle<T>(List<T> items){
  for (var i=items.length-1;i>=1;i--){
    final j = Random().nextInt(i);
    final item = items[i];
    items[i] = items[j];
    items[j] = item;
  }
  return items;
}
