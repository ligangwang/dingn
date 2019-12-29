import 'package:dingn/account/provider_screen.dart';
import 'package:dingn/themes.dart';
import 'package:flutter/material.dart';
import 'package:dingn/account/account_model.dart';
import 'package:provider/provider.dart';


class AccountScreen extends ProviderScreen {
  final bool _readOnlyStatus = true;
  @override
  Widget build(BuildContext context) {
    final accountModel = Provider.of<AccountModel>(context);
    if(accountModel.account == null)
      return Container();
    return Scaffold(
      body: Container(
        alignment: Alignment.center,
        color: Colors.white,
        child: Column(
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(20),
              height: 100.0,
              width: 100.0,
              color: Colors.white,
              child: CircleAvatar(
                backgroundColor: AppTheme.accentColor,
                radius: 50.0,
                backgroundImage: accountModel.account.photoURL == null? null:NetworkImage(accountModel.account.photoURL),
                child: accountModel.account.photoURL == null? Text(accountModel.account.initials) : null
              )
            ),
            Container(
              color: const Color(0xffFFFFFF),
              alignment: Alignment.bottomCenter,
              padding: const EdgeInsets.all(20),
              child:Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: <Widget>[
                  Container(
                    height: 60,
                    alignment: Alignment.center,
                    padding: const EdgeInsets.fromLTRB(0, 0, 0, 30),
                    child: const Text(
                      'Display Name:',
                      style: TextStyle(
                          fontSize: 16.0,
                          fontWeight: FontWeight.bold),
                      ),
                  ),
                  const SizedBox(width: 20),
                  Container(
                    height: 60,
                    alignment: Alignment.bottomCenter,
                    constraints: const BoxConstraints(minWidth: 200, maxWidth: 400),
                    child: TextField(
                      controller: TextEditingController(text: accountModel.account.userName),
                      decoration: InputDecoration(
                        hintText: 'Register Your Display Name',
                        errorText: accountModel.errorMessage,
                      ),
                      readOnly: _readOnlyStatus,
                      autofocus: !_readOnlyStatus,
                      onTap: (){
                        if(_readOnlyStatus){
                          // setState((){
                          //   _readOnlyStatus = false;
                          // });
                        }
                      },
                      onSubmitted: (newValue){
                        newValue = newValue.trim();
                      },
                    )
                  )
                ],
              )
            ),
            Container(
              padding: const EdgeInsets.all(20),
              child: IconButton(
                icon: const Icon(Icons.exit_to_app),
                tooltip: 'Sign out',
                onPressed: ()=>accountModel.signOut()
              )
            )
          ],
        ),
      )
    );
  }
}